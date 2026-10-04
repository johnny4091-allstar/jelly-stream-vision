package app.aurora.mobile

import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.ActivityInfo
import android.graphics.Bitmap
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.view.WindowManager
import android.webkit.*
import android.widget.Button
import android.widget.FrameLayout
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat

class MainActivity : AppCompatActivity() {
    private lateinit var web: WebView
    private lateinit var errorView: View
    private lateinit var fullscreen: FrameLayout
    private lateinit var bars: WindowInsetsControllerCompat
    private var customView: View? = null
    private var customCallback: WebChromeClient.CustomViewCallback? = null
    private var mainFrameFailed = false
    private lateinit var updater: UpdateChecker

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        // Draw edge-to-edge on every Android version (Android 15 forces it anyway)
        // and keep the page clear of the status bar, notch, navigation bar and keyboard.
        WindowCompat.setDecorFitsSystemWindows(window, false)
        bars = WindowInsetsControllerCompat(window, window.decorView)
        bars.isAppearanceLightStatusBars = false
        bars.isAppearanceLightNavigationBars = false
        val root = findViewById<View>(R.id.root)
        ViewCompat.setOnApplyWindowInsetsListener(root) { v, insets ->
            val i = insets.getInsets(
                WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout() or WindowInsetsCompat.Type.ime()
            )
            if (customView == null) v.setPadding(i.left, i.top, i.right, i.bottom) else v.setPadding(0, 0, 0, 0)
            insets
        }

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
            userAgentString = "$userAgentString AuroraMobile/${BuildConfig.VERSION_NAME}"
        }
        // No JavaScript bridge is exposed to the page on purpose (smallest attack surface).
        CookieManager.getInstance().setAcceptCookie(true)

        web.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, req: WebResourceRequest): Boolean {
                if (HostPolicy.isAllowed(req.url)) return false
                // Off-site links (e.g. IMDb, trailers) open in the phone's browser, never inside the app.
                if (req.url.scheme == "https" || req.url.scheme == "http") openExternally(req.url)
                return true
            }

            override fun onPageStarted(view: WebView, url: String?, favicon: Bitmap?) {
                mainFrameFailed = false
            }

            override fun onPageFinished(view: WebView, url: String?) {
                if (!mainFrameFailed) errorView.visibility = View.GONE
            }

            override fun doUpdateVisitedHistory(view: WebView, url: String?, isReload: Boolean) {
                updateKeepScreenOn(url)
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
                // Fullscreen video: landscape (either way up), no system bars, screen stays on.
                requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
                bars.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
                bars.hide(WindowInsetsCompat.Type.systemBars())
                window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                ViewCompat.requestApplyInsets(root)
            }

            override fun onHideCustomView() = exitFullscreen()
            override fun onPermissionRequest(request: PermissionRequest) = request.deny()
            override fun onGeolocationPermissionsShowPrompt(o: String?, c: GeolocationPermissions.Callback) =
                c.invoke(o, false, false)
        }

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() = handleBack()
        })

        when {
            savedInstanceState != null -> web.restoreState(savedInstanceState)
            else -> web.loadUrl(launchUrl(intent))
        }

        updater = UpdateChecker(this)
        updater.checkIfDue(force = true)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        // A site link tapped elsewhere while the app is open.
        if (intent.data != null) web.loadUrl(launchUrl(intent))
    }

    private fun launchUrl(intent: Intent?): String {
        val data = intent?.data
        return if (HostPolicy.isAllowed(data)) data.toString() else BuildConfig.SITE_URL
    }

    private fun openExternally(uri: Uri) {
        try {
            startActivity(Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE))
        } catch (_: ActivityNotFoundException) { }
    }

    /** Keep the screen awake on the player pages so videos aren't interrupted by the screen timeout. */
    private fun updateKeepScreenOn(url: String?) {
        if (customView != null) return
        val path = url?.let { Uri.parse(it).path }.orEmpty()
        if (path.startsWith("/watch/") || path.startsWith("/live/watch/")) {
            window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        } else {
            window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        }
    }

    private fun showError() {
        mainFrameFailed = true
        errorView.visibility = View.VISIBLE
    }

    private fun reload() {
        errorView.visibility = View.GONE
        if (web.url.isNullOrBlank() || !HostPolicy.isAllowed(Uri.parse(web.url))) {
            web.loadUrl(BuildConfig.SITE_URL)
        } else web.reload()
    }

    private fun exitFullscreen() {
        val v = customView ?: return
        fullscreen.removeView(v); fullscreen.visibility = View.GONE
        web.visibility = View.VISIBLE
        customCallback?.onCustomViewHidden()
        customView = null; customCallback = null
        requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
        bars.show(WindowInsetsCompat.Type.systemBars())
        updateKeepScreenOn(web.url)
        ViewCompat.requestApplyInsets(findViewById(R.id.root))
    }

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
