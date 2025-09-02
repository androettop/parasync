#[cfg(target_os = "android")]
pub mod android_saf {
    use jni::objects::{JClass, JObject, JString};
    use jni::sys::{jbyteArray, jobject};
    use jni::JNIEnv;

    pub fn read_all_bytes(env: &JNIEnv, context: JObject, uri: &str) -> Option<Vec<u8>> {
        let uri_js: JString = env.new_string(uri).ok()?;
        // SafKit.readAllBytes(context, uri)
        let class = env.find_class("com/androettop/parasync/SafKit").ok()?;
        let bytes = env
            .call_static_method(
                class,
                "readAllBytes",
                "(Landroid/content/Context;Ljava/lang/String;)[B",
                &[context.into(), uri_js.into()],
            )
            .ok()?;
        let arr: jbyteArray = bytes.l().ok()?.into_inner();
        let out = env.convert_byte_array(arr).ok()?;
        Some(out)
    }
}
