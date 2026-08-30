package expo.modules.chronometernotification

import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.SystemClock
import android.widget.RemoteViews
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

/** One action button. Field names/types must match `ChronometerAction` on the JS side. */
class ActionOption : Record {
  @Field var id: String = ""
  @Field var title: String = ""
}

/**
 * Options for [ChronometerNotificationModule.present]. Field names/types must
 * match `ChronometerPresentOptions` on the JS side (see the module's index.ts).
 */
class PresentOptions : Record {
  @Field var id: String = ""
  @Field var channelId: String = "ongoing"
  @Field var title: String = ""
  @Field var text: String = ""
  // JS numbers cross the bridge as Double; epoch ms fits without loss.
  @Field var anchorMs: Double = 0.0
  @Field var countDown: Boolean = false
  @Field var ongoing: Boolean = true
  // Echoed back on an action tap so JS needn't parse it out of the tag. Empty = unknown.
  @Field var childId: String = ""
  // Buttons in display order; empty = no buttons.
  @Field var actions: List<ActionOption> = emptyList()
}

/**
 * Presents/updates/dismisses notifications that use Android's native `Chronometer`
 * widget, which the system ticks every second on its own — the one way to get a
 * true per-second elapsed/countdown clock in a notification without a foreground
 * service, and something expo-notifications can't express.
 *
 * All of this module's notifications share a single integer notification id and
 * are distinguished by their string **tag** (the JS `id`), so re-presenting the
 * same tag updates in place and reconcile can enumerate exactly ours.
 *
 * Action buttons (running-timer cancel/end) are added directly here — expo's
 * action-category system only reaches notifications posted through
 * expo-notifications, not these. Each button's `PendingIntent` opens the app's
 * own Activity (an explicit-component intent, so the system delivers it and its
 * extras straight to `onNewIntent`/`onCreate` — unlike a MAIN/LAUNCHER intent,
 * which the launcher can swallow) and the tap is handed to JS as
 * `onChronometerAction` (warm start) or via `consumeLastAction` (cold start),
 * shaped to match `service.NotificationActionEvent` so the same
 * `useNotificationActions` handler consumes it.
 */
class ChronometerNotificationModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("ChronometerNotification")

    Events("onChronometerAction")

    // A tap that arrived while the app was already alive: the system routed the
    // button's intent to the running Activity's onNewIntent. (Cold start goes
    // through consumeLastAction instead — onNewIntent isn't called then.)
    OnNewIntent { intent ->
      val payload = consume(intent) ?: consume(appContext.currentActivity?.intent)
      if (payload != null) sendEvent("onChronometerAction", payload)
    }

    // Present or update one chronometer notification. Idempotent per `id`.
    //
    // Draws the clock via a custom `RemoteViews` (`notification_chronometer.xml`)
    // inside `DecoratedCustomViewStyle`, rather than `setUsesChronometer` on the
    // builder directly — the builder-level chronometer renders as small text
    // wedged next to the app name/timestamp, which read as "the smallest detail"
    // of the notification. The custom view puts the same OS-ticked `Chronometer`
    // widget prominently in a start-aligned title / clock / child-name stack (see
    // `notification_chronometer.xml`) — while `DecoratedCustomViewStyle` still
    // wraps it with the system's standard icon/app-name header and renders any
    // action buttons below it.
    AsyncFunction("present") { options: PresentOptions ->
      val ctx = context
      val iconRes =
        if (ctx.applicationInfo.icon != 0) ctx.applicationInfo.icon
        else android.R.drawable.ic_dialog_info

      // `RemoteViews.setChronometer` (like the underlying `Chronometer` widget)
      // bases its ticking on `SystemClock.elapsedRealtime()`, not wall-clock time —
      // passing `anchorMs` (epoch ms) straight through would show a wildly wrong
      // elapsed/remaining time. Convert it to the elapsed-realtime instant that
      // corresponds to the same wall-clock moment; `setWhen` below is unaffected,
      // since the notification header's timestamp *is* wall-clock (epoch ms).
      val elapsedBase =
        SystemClock.elapsedRealtime() + (options.anchorMs.toLong() - System.currentTimeMillis())

      val views = RemoteViews(ctx.packageName, R.layout.notification_chronometer)
      views.setTextViewText(R.id.chrono_title, options.title)
      views.setTextViewText(R.id.chrono_subtitle, options.text)
      views.setChronometer(R.id.chrono_clock, elapsedBase, null, true)
      // Public API since 24; this module's minSdk is already 24 (see build.gradle).
      views.setChronometerCountDown(R.id.chrono_clock, options.countDown)

      // Deliberately no `setColor`/`setColorized`: the app's other notifications
      // go out through expo-notifications with no accent configured, so tinting
      // only this one would make it stand *apart* from them, which is the
      // opposite of what's wanted. Coherence here comes from the header
      // (DecoratedCustomViewStyle) and from the content view using the same
      // androidx notification text appearances the platform uses — see
      // `notification_chronometer.xml`.
      val builder = NotificationCompat.Builder(ctx, options.channelId)
        .setSmallIcon(iconRes)
        .setContentTitle(options.title)
        .setContentText(options.text)
        .setOngoing(options.ongoing)
        .setAutoCancel(false)
        // Re-presents (e.g. when the title/text changes) must not buzz or peek —
        // only the first show may alert; the ticking itself is silent.
        .setOnlyAlertOnce(true)
        .setShowWhen(true)
        .setWhen(options.anchorMs.toLong())
        .setStyle(NotificationCompat.DecoratedCustomViewStyle())
        .setCustomContentView(views)
        .setCustomBigContentView(views)
        .setCategory(NotificationCompat.CATEGORY_STOPWATCH)

      addActions(ctx, builder, options)

      NotificationManagerCompat.from(ctx).notify(options.id, NOTIFICATION_ID, builder.build())
    }

    AsyncFunction("dismiss") { id: String ->
      NotificationManagerCompat.from(context).cancel(id, NOTIFICATION_ID)
    }

    // The action tap that cold-started the app, read from the launch intent's
    // extras and consumed once (cleared so a later call / remount can't redeliver
    // it). Null when the app wasn't launched by one of our buttons.
    AsyncFunction("consumeLastAction") {
      consume(appContext.currentActivity?.intent)
    }

    // Reconcile in one native call: cancel every chronometer notification of ours
    // whose tag is NOT in `wanted`, and report the tags left standing. Doing the
    // whole thing here — rather than `getActiveIds` → JS diff → `dismiss(tag)` —
    // is deliberate: the tag used to cancel is taken **straight from the live
    // `StatusBarNotification`** (`it.tag`), never round-tripped across the JS
    // bridge. A tag containing non-ASCII text (e.g. a Hebrew medicine name in
    // `ongoing-med:1:סימיקול`) can come back from the bridge subtly re-encoded,
    // so `cancel(thatString, id)` no longer matches the posted notification and
    // the dismiss silently no-ops — which left overdue med countdowns stuck as
    // undismissable ongoing notifications. Matching native-side avoids that.
    AsyncFunction("reconcile") { wanted: List<String> ->
      val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      val compat = NotificationManagerCompat.from(context)
      val remaining = mutableListOf<String>()
      for (sbn in nm.activeNotifications) {
        if (sbn.id != NOTIFICATION_ID) continue
        val tag = sbn.tag ?: continue
        if (wanted.contains(tag)) {
          remaining.add(tag)
        } else {
          compat.cancel(tag, NOTIFICATION_ID)
        }
      }
      remaining
    }

    // The tags of the chronometer notifications currently in the tray. Retained
    // for completeness; the reconcile path above no longer needs it.
    AsyncFunction("getActiveIds") {
      val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      nm.activeNotifications
        .filter { it.id == NOTIFICATION_ID }
        .mapNotNull { it.tag }
    }
  }

  /** Attach each option's button as an activity `PendingIntent` that carries the tap back to JS. */
  private fun addActions(ctx: Context, builder: NotificationCompat.Builder, options: PresentOptions) {
    if (options.actions.isEmpty()) return
    // The app's own Activity component; without it we can't route the tap, so skip
    // the buttons rather than post a dead intent.
    val component =
      ctx.packageManager.getLaunchIntentForPackage(ctx.packageName)?.component ?: return
    for (action in options.actions) {
      val intent = Intent(ACTION_TAP).apply {
        setComponent(component)
        // Unique per (tag, action) so no two buttons' PendingIntents are treated
        // as equal (filterEquals ignores extras); the requestCode below already
        // separates them, this is belt-and-suspenders.
        data = Uri.parse("chrono://" + Uri.encode(options.id) + "/" + Uri.encode(action.id))
        // CLEAR_TOP + SINGLE_TOP: bring the single RN Activity to front and deliver
        // onNewIntent rather than recreating it; NEW_TASK for the notification context.
        addFlags(
          Intent.FLAG_ACTIVITY_NEW_TASK or
            Intent.FLAG_ACTIVITY_SINGLE_TOP or
            Intent.FLAG_ACTIVITY_CLEAR_TOP,
        )
        putExtra(EXTRA_ACTION, action.id)
        putExtra(EXTRA_KEY, options.id)
        putExtra(EXTRA_CHILD, options.childId)
      }
      val requestCode = (options.id + "|" + action.id).hashCode()
      val pi = PendingIntent.getActivity(
        ctx,
        requestCode,
        intent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
      // Icon 0: modern Android's decorated template shows the label, not the icon.
      builder.addAction(0, action.title, pi)
    }
  }

  /**
   * Read our action extras off [intent], clearing them so the same tap is never
   * delivered twice (cold-start read + a later warm onNewIntent, or a JS remount).
   * Returns the JS-shaped payload, or null when [intent] carries none of ours.
   *
   * Gated on `intent.action == ACTION_TAP` — only the PendingIntents we build in
   * `addActions` carry it. The Activity is an external entry point, so without
   * this check another app could launch it with spoofed extras and trigger a
   * notification action; matching our private action closes that.
   */
  private fun consume(intent: Intent?): Map<String, Any?>? {
    if (intent == null || intent.action != ACTION_TAP) return null
    val action = intent.getStringExtra(EXTRA_ACTION) ?: return null
    val key = intent.getStringExtra(EXTRA_KEY) ?: return null
    val child = intent.getStringExtra(EXTRA_CHILD) ?: ""
    intent.removeExtra(EXTRA_ACTION)
    intent.removeExtra(EXTRA_KEY)
    intent.removeExtra(EXTRA_CHILD)
    return mapOf(
      "actionIdentifier" to action,
      "id" to key,
      "childId" to child.ifEmpty { null },
    )
  }

  companion object {
    // Shared across every chronometer notification; the string tag disambiguates.
    // A fixed, module-specific constant so `getActiveIds` can isolate ours.
    private const val NOTIFICATION_ID = 0x0B0B

    // A non-MAIN action on the button intents, so the launcher doesn't treat a tap
    // as a relaunch (which can drop the extras / skip onNewIntent).
    private const val ACTION_TAP = "expo.modules.chronometernotification.ACTION_TAP"
    private const val EXTRA_ACTION = "chrono.action"
    private const val EXTRA_KEY = "chrono.key"
    private const val EXTRA_CHILD = "chrono.child"
  }
}
