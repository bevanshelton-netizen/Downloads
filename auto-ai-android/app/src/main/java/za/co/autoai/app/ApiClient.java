package za.co.autoai.app;

import android.app.Activity;
import android.os.Handler;
import android.os.Looper;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import javax.net.ssl.HttpsURLConnection;

final class ApiClient {
    interface Callback {
        void onSuccess(JSONObject json);
        void onError(String message);
    }

    private final ExecutorService executor = Executors.newCachedThreadPool();
    private final Handler main = new Handler(Looper.getMainLooper());

    void get(String path, Callback callback) {
        executor.execute(() -> {
            HttpsURLConnection connection = null;
            try {
                URL url = new URL(resolve(path));
                connection = (HttpsURLConnection) url.openConnection();
                connection.setRequestMethod("GET");
                connection.setConnectTimeout(10000);
                connection.setReadTimeout(15000);
                connection.setRequestProperty("Accept", "application/json");
                connection.setRequestProperty("User-Agent", "AUTO-AI-Android/1.0");
                int status = connection.getResponseCode();
                String body = read(status >= 200 && status < 300 ? connection.getInputStream() : connection.getErrorStream());
                if (status >= 200 && status < 300) {
                    JSONObject json = new JSONObject(body);
                    main.post(() -> callback.onSuccess(json));
                } else {
                    main.post(() -> callback.onError("Service returned HTTP " + status));
                }
            } catch (Exception error) {
                main.post(() -> callback.onError(error.getMessage() == null ? "Connection failed" : error.getMessage()));
            } finally {
                if (connection != null) connection.disconnect();
            }
        });
    }

    void post(String path, JSONObject payload, Callback callback) {
        executor.execute(() -> {
            HttpsURLConnection connection = null;
            try {
                URL url = new URL(resolve(path));
                connection = (HttpsURLConnection) url.openConnection();
                connection.setRequestMethod("POST");
                connection.setConnectTimeout(10000);
                connection.setReadTimeout(20000);
                connection.setDoOutput(true);
                connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
                connection.setRequestProperty("Accept", "application/json");
                connection.setRequestProperty("User-Agent", "AUTO-AI-Android/1.0");

                byte[] bytes = payload.toString().getBytes(StandardCharsets.UTF_8);
                connection.setFixedLengthStreamingMode(bytes.length);
                try (OutputStream output = connection.getOutputStream()) {
                    output.write(bytes);
                }

                int status = connection.getResponseCode();
                String body = read(status >= 200 && status < 300 ? connection.getInputStream() : connection.getErrorStream());
                if (status >= 200 && status < 300) {
                    JSONObject json = new JSONObject(body);
                    main.post(() -> callback.onSuccess(json));
                } else {
                    main.post(() -> callback.onError("Service returned HTTP " + status));
                }
            } catch (Exception error) {
                main.post(() -> callback.onError(error.getMessage() == null ? "Connection failed" : error.getMessage()));
            } finally {
                if (connection != null) connection.disconnect();
            }
        });
    }

    private String resolve(String path) {
        String base = BuildConfig.API_BASE;
        if (!base.endsWith("/")) base += "/";
        while (path.startsWith("/")) path = path.substring(1);
        return base + path;
    }

    private String read(InputStream input) throws Exception {
        if (input == null) return "";
        StringBuilder out = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(input, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) out.append(line);
        }
        return out.toString();
    }
}
