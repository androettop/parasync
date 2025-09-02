package com.androettop.parasync

import android.content.ContentResolver
import android.content.Context
import android.net.Uri
import java.io.BufferedInputStream
import java.io.BufferedOutputStream

object SafKit {
    @JvmStatic
    fun readAllBytes(context: Context, uriStr: String): ByteArray {
        val uri = Uri.parse(uriStr)
        val cr: ContentResolver = context.contentResolver
        cr.openInputStream(uri).use { input ->
            if (input == null) return ByteArray(0)
            val bis = BufferedInputStream(input)
            return bis.readBytes()
        }
    }

    @JvmStatic
    fun writeAllBytes(context: Context, uriStr: String, data: ByteArray) {
        val uri = Uri.parse(uriStr)
        val cr: ContentResolver = context.contentResolver
        cr.openOutputStream(uri, "w").use { output ->
            if (output == null) return
            val bos = BufferedOutputStream(output)
            bos.write(data)
            bos.flush()
        }
    }
}
