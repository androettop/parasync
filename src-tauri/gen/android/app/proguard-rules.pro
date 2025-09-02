# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile
# Keep MainActivity methods called from native code (JNI). Replace package
# if you change applicationId.
-keepclassmembers class com.androettop.parasync.MainActivity {
	public java.lang.String selectSongsDirBlocking();
	public java.lang.String getSongsDirPersisted();
	public boolean copyDirFromAppToSongs(java.lang.String, java.lang.String, boolean);
	public boolean copyDirFromSongsToApp(java.lang.String, java.lang.String, boolean);
	public java.lang.String safListDir(java.lang.String);
	public java.lang.String safReadTextFile(java.lang.String);
	public byte[] safReadFile(java.lang.String);
	public boolean safRemove(java.lang.String, boolean);
}