package expo.modules.chronometernotification

import android.app.NotificationManager
import android.content.Context
import android.widget.RemoteViews
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

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
}

/**
 * Presents/updates/dismisses notifications that use Android's native chronometer
 * (`setUsesChronometer`), which the system ticks every second on its own — the
 * one way to get a true per-second elapsed/countdown clock in a notification
 * without a foreground service, and something expo-notifications can't express.
 *
 * All of this module's notifications share a single integer notification id and
 * are distinguished by their string **tag** (the JS `id`), so re-presenting the
 * same tag updates in place and reconcile can enumerate exactly ours.
 */
class ChronometerNotificationModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("ChronometerNotification")

    // Present or update one chronometer notification. Idempotent per `id`.
    //
    // Draws the clock via a custom `RemoteViews` (`notification_chronometer.xml`)
    // inside `DecoratedCustomViewStyle`, rather than `setUsesChronometer` on the
    // builder directly — the builder-level chronometer renders as small text
    // wedged next to the app name/timestamp, which read as "the smallest detail"
    // of the notification. The custom view puts the same OS-ticked `Chronometer`
    // widget front and center, big, the way Android's own Clock app does for a
    // running timer — while `DecoratedCustomViewStyle` still wraps it with the
    // system's standard icon/app-name header and (if ever added) action buttons.
    AsyncFunction("present") { options: PresentOptions ->
      val ctx = context
      val iconRes =
        if (ctx.applicationInfo.icon != 0) ctx.applicationInfo.icon
        else android.R.drawable.ic_dialog_info

      val views = RemoteViews(ctx.packageName, R.layout.notification_chronometer)
      views.setTextViewText(R.id.chrono_title, options.title)
      views.setTextViewText(R.id.chrono_subtitle, options.text)
      views.setChronometer(R.id.chrono_clock, options.anchorMs.toLong(), null, true)
      // Public API since 24; this module's minSdk is already 24 (see build.gradle).
      views.setChronometerCountDown(R.id.chrono_clock, options.countDown)

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

      NotificationManagerCompat.from(ctx).notify(options.id, NOTIFICATION_ID, builder.build())
    }

    AsyncFunction("dismiss") { id: String ->
      NotificationManagerCompat.from(context).cancel(id, NOTIFICATION_ID)
    }

    // The tags of the chronometer notifications currently in the tray, so the JS
    // reconcile can dismiss the ones whose timer/med is no longer live. Filtered
    // to our shared notification id so a stray expo-notifications entry can never
    // be mistaken for ours (and thus never wrongly dismissed).
    AsyncFunction("getActiveIds") {
      val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      nm.activeNotifications
        .filter { it.id == NOTIFICATION_ID }
        .mapNotNull { it.tag }
    }
  }

  companion object {
    // Shared across every chronometer notification; the string tag disambiguates.
    // A fixed, module-specific constant so `getActiveIds` can isolate ours.
    private const val NOTIFICATION_ID = 0x0B0B
  }
}
