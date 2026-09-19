package za.co.autoai.app;

import android.app.Activity;
import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Locale;

public class MainActivity extends Activity {
    private ApiClient api;

    private LinearLayout panelSymptoms;
    private LinearLayout panelCode;
    private LinearLayout panelQuote;
    private LinearLayout panelUsed;

    private EditText edYear;
    private EditText edMake;
    private EditText edModel;
    private EditText edSymptoms;
    private EditText edWarning;
    private EditText edCode;
    private EditText edQuote;

    private TextView tvConnection;
    private TextView resultSymptoms;
    private TextView resultCode;
    private TextView resultQuote;
    private TextView resultUsed;

    private CheckBox chkWarnings;
    private CheckBox chkOverheat;
    private CheckBox chkAccident;
    private CheckBox chkVibration;
    private CheckBox chkHistory;
    private CheckBox chkDocs;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.rgb(7, 16, 28));
        getWindow().setNavigationBarColor(Color.rgb(7, 16, 28));
        setContentView(R.layout.activity_main);

        api = new ApiClient();

        bindViews();
        bindTabs();
        bindActions();
        showPanel(panelSymptoms);
        checkHealth();
    }

    private void bindViews() {
        panelSymptoms = findViewById(R.id.panelSymptoms);
        panelCode = findViewById(R.id.panelCode);
        panelQuote = findViewById(R.id.panelQuote);
        panelUsed = findViewById(R.id.panelUsed);

        edYear = findViewById(R.id.edYear);
        edMake = findViewById(R.id.edMake);
        edModel = findViewById(R.id.edModel);
        edSymptoms = findViewById(R.id.edSymptoms);
        edWarning = findViewById(R.id.edWarning);
        edCode = findViewById(R.id.edCode);
        edQuote = findViewById(R.id.edQuote);

        tvConnection = findViewById(R.id.tvConnection);
        resultSymptoms = findViewById(R.id.resultSymptoms);
        resultCode = findViewById(R.id.resultCode);
        resultQuote = findViewById(R.id.resultQuote);
        resultUsed = findViewById(R.id.resultUsed);

        chkWarnings = findViewById(R.id.chkWarnings);
        chkOverheat = findViewById(R.id.chkOverheat);
        chkAccident = findViewById(R.id.chkAccident);
        chkVibration = findViewById(R.id.chkVibration);
        chkHistory = findViewById(R.id.chkHistory);
        chkDocs = findViewById(R.id.chkDocs);
    }

    private void bindTabs() {
        findViewById(R.id.tabSymptoms).setOnClickListener(v -> showPanel(panelSymptoms));
        findViewById(R.id.tabCode).setOnClickListener(v -> showPanel(panelCode));
        findViewById(R.id.tabQuote).setOnClickListener(v -> showPanel(panelQuote));
        findViewById(R.id.tabUsed).setOnClickListener(v -> showPanel(panelUsed));
    }

    private void bindActions() {
        Button analyse = findViewById(R.id.btnAnalyse);
        Button explain = findViewById(R.id.btnExplainCode);
        Button quote = findViewById(R.id.btnReviewQuote);
        Button used = findViewById(R.id.btnUsedCheck);

        analyse.setOnClickListener(v -> runTriage(analyse));
        explain.setOnClickListener(v -> explainCode(explain));
        quote.setOnClickListener(v -> reviewQuote(quote));
        used.setOnClickListener(v -> checkUsedCar(used));
    }

    private void showPanel(View selected) {
        panelSymptoms.setVisibility(selected == panelSymptoms ? View.VISIBLE : View.GONE);
        panelCode.setVisibility(selected == panelCode ? View.VISIBLE : View.GONE);
        panelQuote.setVisibility(selected == panelQuote ? View.VISIBLE : View.GONE);
        panelUsed.setVisibility(selected == panelUsed ? View.VISIBLE : View.GONE);
    }

    private void checkHealth() {
        api.get("/api/health", new ApiClient.Callback() {
            @Override
            public void onSuccess(JSONObject json) {
                if (json.optBoolean("ok")) {
                    tvConnection.setText("ONLINE");
                    tvConnection.setTextColor(Color.rgb(50, 224, 196));
                } else {
                    setOffline();
                }
            }

            @Override
            public void onError(String message) {
                setOffline();
            }
        });
    }

    private void setOffline() {
        tvConnection.setText("OFFLINE");
        tvConnection.setTextColor(Color.rgb(255, 93, 100));
    }

    private void runTriage(Button button) {
        String symptoms = text(edSymptoms);
        if (symptoms.length() < 5) {
            resultSymptoms.setText("Tell AUTO AI what the vehicle is doing first.");
            return;
        }

        try {
            JSONObject body = new JSONObject();
            body.put("year", text(edYear));
            body.put("make", text(edMake));
            body.put("model", text(edModel));
            body.put("symptoms", symptoms);
            body.put("warningLights", text(edWarning));
            body.put("language", "English");

            busy(button, true, "CHECKING...");
            api.post("/api/triage", body, new ApiClient.Callback() {
                @Override
                public void onSuccess(JSONObject json) {
                    busy(button, false, "CHECK MY CAR");
                    resultSymptoms.setText(formatTriage(json));
                }

                @Override
                public void onError(String message) {
                    busy(button, false, "CHECK MY CAR");
                    if (looksDangerous(symptoms + " " + text(edWarning))) {
                        resultSymptoms.setText("STOP / SAFETY FIRST\n\nThe service is temporarily unreachable, but what you entered could describe a safety-critical fault. Stop driving as soon as it is safe to do so and arrange qualified inspection or recovery. Do not rely on this app alone.\n\nConnection: " + message);
                    } else {
                        resultSymptoms.setText("AUTO AI could not reach the diagnostic service. Please check your connection and try again.\n\n" + message);
                    }
                }
            });
        } catch (Exception error) {
            resultSymptoms.setText("Could not prepare the vehicle check.");
        }
    }

    private String formatTriage(JSONObject json) {
        String urgency = json.optString("urgency", "CHECK");
        StringBuilder out = new StringBuilder();
        out.append(urgency).append("\n\n");
        out.append(json.optString("safety", "")).append("\n\n");
        appendArray(out, "Possible area", json.optJSONArray("likely_categories"));
        appendArray(out, "Next checks", json.optJSONArray("next_checks"));
        JSONArray questions = json.optJSONArray("questions");
        if (questions != null && questions.length() > 0) appendArray(out, "Questions", questions);
        out.append("\nConfidence: ").append(json.optString("confidence", "preliminary"));
        out.append("\n\n").append(json.optString("disclaimer", "Decision support only."));
        return out.toString();
    }

    private void explainCode(Button button) {
        String code = text(edCode).toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]", "");
        if (code.length() < 4) {
            resultCode.setText("Enter a diagnostic trouble code, for example P0420.");
            return;
        }

        try {
            JSONObject body = new JSONObject();
            body.put("code", code);
            busy(button, true, "CHECKING...");
            api.post("/api/fault-code", body, new ApiClient.Callback() {
                @Override
                public void onSuccess(JSONObject json) {
                    busy(button, false, "EXPLAIN CODE");
                    String output = json.optString("code", code) + " — " + json.optString("meaning", "Unknown code") +
                            "\n\nPossible causes\n" + json.optString("possibleCauses", "Further testing required.") +
                            "\n\nWhat to do\n" + json.optString("advice", "Test before replacing parts.") +
                            "\n\n" + json.optString("disclaimer", "");
                    resultCode.setText(output);
                }

                @Override
                public void onError(String message) {
                    busy(button, false, "EXPLAIN CODE");
                    resultCode.setText("Could not reach AUTO AI. Do not replace a part based only on an unverified fault code.\n\n" + message);
                }
            });
        } catch (Exception error) {
            resultCode.setText("Could not prepare the fault-code check.");
        }
    }

    private void reviewQuote(Button button) {
        String quote = text(edQuote);
        if (quote.length() < 20) {
            resultQuote.setText("Paste enough of the workshop quote for AUTO AI to review the items, labour and diagnostic basis.");
            return;
        }

        try {
            JSONObject body = new JSONObject();
            body.put("quote", quote);
            busy(button, true, "REVIEWING...");
            api.post("/api/quote-review", body, new ApiClient.Callback() {
                @Override
                public void onSuccess(JSONObject json) {
                    busy(button, false, "REVIEW THIS QUOTE");
                    StringBuilder out = new StringBuilder();
                    out.append(json.optString("result", "REVIEW")).append("\n\n");
                    appendArray(out, "Flags", json.optJSONArray("flags"));
                    appendArray(out, "Ask the workshop", json.optJSONArray("askWorkshop"));
                    out.append("\n").append(json.optString("disclaimer", ""));
                    resultQuote.setText(out.toString());
                }

                @Override
                public void onError(String message) {
                    busy(button, false, "REVIEW THIS QUOTE");
                    resultQuote.setText("AUTO AI could not reach the quote-review service. Do not authorise expensive replacement work solely from a fault code or vague quotation.\n\n" + message);
                }
            });
        } catch (Exception error) {
            resultQuote.setText("Could not prepare the quote review.");
        }
    }

    private void checkUsedCar(Button button) {
        try {
            JSONArray issues = new JSONArray();
            issues.put(issue("Dashboard warning lights", "high", chkWarnings.isChecked()));
            issues.put(issue("Overheating, smoke or fluid leak", "high", chkOverheat.isChecked()));
            issues.put(issue("Possible accident repair or uneven panels", "medium", chkAccident.isChecked()));
            issues.put(issue("Vibration, pulling or abnormal noise", "medium", chkVibration.isChecked()));
            issues.put(issue("No credible service history", "medium", chkHistory.isChecked()));
            issues.put(issue("VIN or ownership/document concern", "high", chkDocs.isChecked()));

            JSONObject body = new JSONObject();
            body.put("issues", issues);

            busy(button, true, "CHECKING...");
            api.post("/api/used-car-score", body, new ApiClient.Callback() {
                @Override
                public void onSuccess(JSONObject json) {
                    busy(button, false, "CHECK THIS CAR");
                    StringBuilder out = new StringBuilder();
                    out.append("Risk screen: ").append(json.optString("band", "CHECK")).append("\n");
                    out.append("Screening score: ").append(json.optInt("score", 0)).append("/100\n\n");
                    appendArray(out, "Concerns", json.optJSONArray("concerns"));
                    appendArray(out, "Before you buy", json.optJSONArray("next"));
                    out.append("\n").append(json.optString("disclaimer", ""));
                    resultUsed.setText(out.toString());
                }

                @Override
                public void onError(String message) {
                    busy(button, false, "CHECK THIS CAR");
                    resultUsed.setText("AUTO AI could not reach the buyer-check service. Do not buy without verifying VIN/ownership and, where material concerns exist, getting an independent physical inspection.\n\n" + message);
                }
            });
        } catch (Exception error) {
            resultUsed.setText("Could not prepare the used-car check.");
        }
    }

    private JSONObject issue(String label, String severity, boolean checked) throws Exception {
        JSONObject item = new JSONObject();
        item.put("label", label);
        item.put("severity", severity);
        item.put("checked", checked);
        return item;
    }

    private void appendArray(StringBuilder out, String title, JSONArray array) {
        if (array == null || array.length() == 0) return;
        out.append(title).append("\n");
        for (int i = 0; i < array.length(); i++) {
            out.append("• ").append(array.optString(i)).append("\n");
        }
        out.append("\n");
    }

    private String text(EditText editText) {
        return editText.getText() == null ? "" : editText.getText().toString().trim();
    }

    private void busy(Button button, boolean busy, String text) {
        button.setEnabled(!busy);
        button.setText(text);
    }

    private boolean looksDangerous(String value) {
        String text = value.toLowerCase(Locale.ROOT);
        String[] danger = {
                "no brakes", "brake pedal", "oil pressure", "overheat", "temperature red",
                "fuel leak", "petrol leak", "diesel leak", "fire", "smoke from engine",
                "steering locked", "wheel loose"
        };
        for (String term : danger) if (text.contains(term)) return true;
        return false;
    }
}
