package expo.modules.exportdownloads

import android.annotation.TargetApi
import android.content.ContentResolver
import android.content.ContentValues
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.util.Base64
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class SaveToDownloadsException(cause: Throwable?) :
  CodedException("ERR_SAVE_DOWNLOADS", "Não foi possível salvar o arquivo em Downloads.", cause)

class ExportDownloadsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ExportDownloads")

    Function("isSupported") {
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
    }

    AsyncFunction("saveBase64ToDownloads") { base64: String, fileName: String, mimeType: String ->
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
        throw SaveToDownloadsException(null)
      }
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      saveToDownloads(context.contentResolver, Base64.decode(base64, Base64.DEFAULT), fileName, mimeType)
    }
  }

  // MediaStore.Downloads só existe a partir do Android 10 (API 29) e não exige permissão de armazenamento.
  @TargetApi(Build.VERSION_CODES.Q)
  private fun saveToDownloads(
    resolver: ContentResolver,
    bytes: ByteArray,
    fileName: String,
    mimeType: String
  ): Map<String, String> {
    val collection = MediaStore.Downloads.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
    val values = ContentValues().apply {
      put(MediaStore.Downloads.DISPLAY_NAME, fileName)
      put(MediaStore.Downloads.MIME_TYPE, mimeType)
      put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
      put(MediaStore.Downloads.IS_PENDING, 1)
    }

    val uri = resolver.insert(collection, values) ?: throw SaveToDownloadsException(null)
    try {
      val stream = resolver.openOutputStream(uri) ?: throw SaveToDownloadsException(null)
      stream.use { it.write(bytes) }

      values.clear()
      values.put(MediaStore.Downloads.IS_PENDING, 0)
      resolver.update(uri, values, null, null)

      var savedName = fileName
      resolver.query(uri, arrayOf(MediaStore.Downloads.DISPLAY_NAME), null, null, null)?.use { cursor ->
        if (cursor.moveToFirst()) {
          savedName = cursor.getString(0) ?: fileName
        }
      }
      return mapOf("uri" to uri.toString(), "fileName" to savedName)
    } catch (e: Throwable) {
      resolver.delete(uri, null, null)
      if (e is CodedException) throw e
      throw SaveToDownloadsException(e)
    }
  }
}
