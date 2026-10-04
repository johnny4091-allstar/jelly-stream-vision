package app.aurora.tv

import android.annotation.SuppressLint
import android.graphics.Bitmap
import android.os.Bundle
import android.view.KeyEvent
import android.view.View
import android.view.WindowManager
import android.webkit.*
import android.widget.Button
import android.widget.FrameLayout
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {
    private lateinit var web: WebView
    private lateinit var errorView: View
    private lateinit var fullscreen: FrameLayout
    private var customView: View? = null
    private var customCallback: WebChromeClient.CustomViewCallback? = null
    private var mainFrameFailed = false
    private lateinit var updater: UpdateChecker

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        web = findViewById(R.id.webview)
        errorView = findViewById(R.id.error)
        fullscreen = findViewById(R.id.fullscreen)
        findViewById<Button>(R.id.retry).setOnClickListener { reload() }

        web.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false
            allowFileAccess = false
            allowContentAccess = false
            setSupportMultipleWindows(false)
            javaScriptCanOpenWindowsAutomatically = false
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            userAgentString = "$userAgentString AuroraTV/${BuildConfig.VERSION_NAME}"
        }
        // No JavaScript bridge is exposed to the page on purpose (smallest attack surface).
        CookieManager.getInstance().setAcceptCookie(true)

        web.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, req: WebResourceRequest): Boolean =
                !HostPolicy.isAllowed(req.url) // block anything off-allowlist

            override fun onPageStarted(view: WebView, url: String?, favicon: Bitmap?) {
                mainFrameFailed = false
            }

            override fun onPageFinished(view: WebView, url: String?) {
                if (!mainFrameFailed) errorView.visibility = View.GONE
            }

            override fun onReceivedError(view: WebView, req: WebResourceRequest, err: WebResourceError) {
                if (req.isForMainFrame) showError()
            }

            override fun onReceivedHttpError(view: WebView, req: WebResourceRequest, res: WebResourceResponse) {
                if (req.isForMainFrame && res.statusCode >= 500) showError()
            }

            override fun onReceivedSslError(view: WebView, h: SslErrorHandler, e: android.net.http.SslError) {
                h.cancel(); showError()
            }
        }

        web.webChromeClient = object : WebChromeClient() {
            override fun onShowCustomView(view: View, callback: CustomViewCallback) {
                if (customView != null) { callback.onCustomViewHidden(); return }
                customView = view; customCallback = callback
                fullscreen.addView(view); fullscreen.visibility = View.VISIBLE
                web.visibility = View.GONE
            }

            override fun onHideCustomView() = exitFullscreen()
            override fun onPermissionRequest(request: PermissionRequest) = request.deny()
            override fun onGeolocationPermissionsShowPrompt(o: String?, c: GeolocationPermissions.Callback) =
                c.invoke(o, false, false)
        }

        if (savedInstanceState != null) web.restoreState(savedInstanceState) else web.loadUrl(BuildConfig.SITE_URL)
        web.requestFocus()

        updater = UpdateChecker(this)
        updater.checkIfDue(force = true)
    }

    private fun showError() {
        mainFrameFailed = true
        errorView.visibility = View.VISIBLE
        findViewById<Button>(R.id.retry).requestFocus()
    }

    private fun reload() {
        errorView.visibility = View.GONE
        if (web.url.isNullOrBlank() || !HostPolicy.isAllowed(android.net.Uri.parse(web.url))) {
            web.loadUrl(BuildConfig.SITE_URL)
        } else web.reload()
        web.requestFocus()
    }

    private fun exitFullscreen() {
        val v = customView ?: return
        fullscreen.removeView(v); fullscreen.visibility = View.GONE
        web.visibility = View.VISIBLE
        customCallback?.onCustomViewHidden()
        customView = null; customCallback = null
        web.requestFocus()
    }

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        if (event.keyCode == KeyEvent.KEYCODE_BACK && event.action == KeyEvent.ACTION_UP) {
            handleBack(); return true
        }
        if (event.keyCode == KeyEvent.KEYCODE_BACK) return true
        return super.dispatchKeyEvent(event)
    }

    @Deprecated("Back is routed through dispatchKeyEvent")
    override fun onBackPressed() = handleBack()

    /** Back order: fullscreen video -> error screen -> in-page modal -> history -> exit. */
    private fun handleBack() {
        if (customView != null) { exitFullscreen(); return }
        if (errorView.visibility == View.VISIBLE) { finish(); return }
        val js = """
            (function(){
              var m=document.querySelector('[data-tv-modal],[aria-modal="true"],[role="dialog"]');
              if(!m) return false;
              var t=document.activeElement||m;
              t.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
              return true;
            })()
        """.trimIndent()
        web.evaluateJavascript(js) { result ->
            if (result == "true") return@evaluateJavascript
            if (web.canGoBack()) web.goBack() else finish()
        }
    }

    override fun onResume() {
        super.onResume(); web.onResume(); web.resumeTimers()
        updater.checkIfDue(force = false)
    }

    override fun onPause() {
        web.onPause(); web.pauseTimers()
        CookieManager.getInstance().flush()
        super.onPause()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState); web.saveState(outState)
    }

    override fun onDestroy() {
        updater.cancel()
        web.stopLoading(); web.destroy()
        super.onDestroy()
    }
}
