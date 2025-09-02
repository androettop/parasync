package com.androettop.parasync

import android.content.ContentResolver
import android.content.Context
import android.net.Uri
import android.provider.DocumentsContract
import androidx.documentfile.provider.DocumentFile
import java.io.BufferedInputStream
import java.io.BufferedOutputStream

object SafKit {
    @JvmStatic
    fun readAllBytes(context: Context, uriStr: String): ByteArray {
        val uri0 = Uri.parse(uriStr)
        // Support optional relative path appended as query ?rel=...
        val (baseUri, rel) = parseBaseAndRel(uri0)
        val targetUri = if (rel != null) {
            resolveChildUri(context, baseUri, rel) ?: baseUri
        } else baseUri
        val uri = targetUri
        val cr: ContentResolver = context.contentResolver
        cr.openInputStream(uri).use { input ->
            if (input == null) return ByteArray(0)
            val bis = BufferedInputStream(input)
            return bis.readBytes()
        }
    }

    @JvmStatic
    fun writeAllBytes(context: Context, uriStr: String, data: ByteArray) {
        val uri0 = Uri.parse(uriStr)
        val (baseUri, rel) = parseBaseAndRel(uri0)
        val cr: ContentResolver = context.contentResolver

        val target: Uri? = if (rel != null) {
            // Walk and create directories; create file at last segment if missing
            var doc: DocumentFile? = DocumentFile.fromTreeUri(context, baseUri)
            if (doc == null) return
            val parts = rel.split('/')
            for ((idx, p) in parts.withIndex()) {
                if (p.isEmpty()) continue
                val isLast = idx == parts.size - 1
                var next = doc?.findFile(p)
                if (next == null) {
                    next = if (isLast) {
                        // Generic mime; Android doesn't require strict mime
                        doc?.createFile("application/octet-stream", p)
                    } else {
                        doc?.createDirectory(p)
                    }
                }
                doc = next
                if (doc == null) return
            }
            doc?.uri
        } else baseUri

        val uri = target ?: return
        cr.openOutputStream(uri, "w").use { output ->
            if (output == null) return
            val bos = BufferedOutputStream(output)
            bos.write(data)
            bos.flush()
        }
    }

    @JvmStatic
    fun ensureDir(context: Context, uriStr: String): Boolean {
        val uri0 = Uri.parse(uriStr)
        val (baseUri, rel) = parseBaseAndRel(uri0)
        var doc: DocumentFile? = DocumentFile.fromTreeUri(context, baseUri)
        if (doc == null) return false
        if (rel == null) return true
        val parts = rel.split('/')
        for (p in parts) {
            if (p.isEmpty()) continue
            var next = doc?.findFile(p)
            if (next == null) {
                next = doc?.createDirectory(p)
            }
            doc = next
            if (doc == null) return false
        }
        return true
    }

    @JvmStatic
    fun listChildren(context: Context, treeUriStr: String): Array<String> {
        val (baseUri, rel) = parseBaseAndRel(Uri.parse(treeUriStr))
        var doc: DocumentFile? = DocumentFile.fromTreeUri(context, baseUri)
        if (doc == null) return emptyArray()
        if (rel != null) {
            // Traverse to target directory
            val parts = rel.split('/')
            for (p in parts) {
                if (p.isEmpty()) continue
                doc = doc?.findFile(p)
                if (doc == null) return emptyArray()
            }
        }
        val out = mutableListOf<String>()
        for (child in doc!!.listFiles()) {
            val name = child.name ?: continue
            val isDir = if (child.isDirectory) 1 else 0
            // encode as "name\tisDir"
            out.add("${name}\t${isDir}")
        }
        return out.toTypedArray()
    }

    private fun parseBaseAndRel(uri: Uri): Pair<Uri, String?> {
        val rel = uri.getQueryParameter("rel")
        val base = if (rel != null) uri.buildUpon().clearQuery().build() else uri
        return Pair(base, rel)
    }

    private fun resolveChildUri(context: Context, treeUri: Uri, rel: String): Uri? {
        // Traverse children using DocumentFile
        var current: DocumentFile? = DocumentFile.fromTreeUri(context, treeUri)
        if (current == null) return null
        val parts = rel.split('/')
        for (p in parts) {
            if (p.isEmpty()) continue
            current = current?.findFile(p)
            if (current == null) return null
        }
        return current?.uri
    }

    @JvmStatic
    fun deleteRecursively(context: Context, uriStr: String): Boolean {
        val (baseUri, rel) = parseBaseAndRel(Uri.parse(uriStr))
        val rootDoc = if (rel != null) {
            val resolved = resolveChildUri(context, baseUri, rel) ?: return false
            DocumentFile.fromSingleUri(context, resolved)
                ?: DocumentFile.fromTreeUri(context, resolved)
        } else {
            DocumentFile.fromTreeUri(context, baseUri)
        } ?: return false
        return deleteDocRecursive(rootDoc)
    }

    private fun deleteDocRecursive(doc: DocumentFile): Boolean {
        return if (doc.isDirectory) {
            for (c in doc.listFiles()) {
                if (!deleteDocRecursive(c)) return false
            }
            doc.delete()
        } else {
            doc.delete()
        }
    }
}
