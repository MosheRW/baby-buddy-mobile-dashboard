package expo.modules.chronometernotification

import android.app.NotificationManager
import android.content.Context
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
    AsyncFunction("present") { options: PresentOptions ->
      val ctx = context
      val iconRes =
        if (ctx.applicationInfo.icon != 0) ctx.applicationInfo.icon
        else android.R.drawable.ic_dialog_info

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
        .setUsesChronometer(true)
        .setWhen(options.anchorMs.toLong())
        // NotificationCompat guards this to API 24+ internally.
        .setChronometerCountDown(options.countDown)
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
