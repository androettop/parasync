fn main() {
    // Add Android-specific linking for C++ standard library
    if std::env::var("CARGO_CFG_TARGET_OS").unwrap_or_default() == "android" {
        println!("cargo:rustc-link-lib=c++_shared");
        println!("cargo:rustc-link-lib=log");
        println!("cargo:rustc-link-lib=aaudio");
        println!("cargo:rustc-link-lib=OpenSLES");
        println!("cargo:rustc-link-lib=android");
    }
    
    tauri_build::build()
}
