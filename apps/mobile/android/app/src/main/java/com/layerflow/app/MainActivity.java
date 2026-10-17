package com.layerflow.app;

import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;
import java.io.IOException;
import java.io.InputStream;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        bridge.setWebViewClient(new CleanUrlClient(bridge));
    }

    /**
     * The app's pages are Next's static export: /dashboard lives in public/dashboard.html.
     * Capacitor's local server answers every extension-less path with the root index.html
     * (single-page-app style), so a reload or deep link onto /dashboard would show Home.
     * This serves /dashboard from dashboard.html instead, like a static host with clean
     * URLs, and leaves every other request to Capacitor.
     */
    static class CleanUrlClient extends BridgeWebViewClient {

        private final Bridge bridge;
        private final Map<String, Boolean> exists = new ConcurrentHashMap<>();

        CleanUrlClient(Bridge bridge) {
            super(bridge);
            this.bridge = bridge;
        }

        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            Uri url = request.getUrl();
            String path = url.getPath();
            if (bridge.getHost().equals(url.getHost()) && path != null && path.length() > 1) {
                String page = path.endsWith("/") ? path.substring(0, path.length() - 1) : path;
                String last = page.substring(page.lastIndexOf('/') + 1);
                if (!last.contains(".") && hasAsset("public" + page + ".html")) {
                    return super.shouldInterceptRequest(view, new Rewritten(request, url.buildUpon().path(page + ".html").build()));
                }
            }
            return super.shouldInterceptRequest(view, request);
        }

        private boolean hasAsset(String name) {
            return exists.computeIfAbsent(name, (n) -> {
                try (InputStream ignored = bridge.getContext().getAssets().open(n)) {
                    return true;
                } catch (IOException e) {
                    return false;
                }
            });
        }
    }

    /** The same request, pointed at another URL. */
    static class Rewritten implements WebResourceRequest {

        private final WebResourceRequest original;
        private final Uri url;

        Rewritten(WebResourceRequest original, Uri url) {
            this.original = original;
            this.url = url;
        }

        @Override
        public Uri getUrl() {
            return url;
        }

        @Override
        public boolean isForMainFrame() {
            return original.isForMainFrame();
        }

        @Override
        public boolean isRedirect() {
            return original.isRedirect();
        }

        @Override
        public boolean hasGesture() {
            return original.hasGesture();
        }

        @Override
        public String getMethod() {
            return original.getMethod();
        }

        @Override
        public Map<String, String> getRequestHeaders() {
            return original.getRequestHeaders();
        }
    }
}
