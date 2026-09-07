const LAST_UPDATED = "September 2026";

export const PRIVACY_POLICY = `Last updated: ${LAST_UPDATED}

FitPocket is created and managed by Pocket Projects ("we", "us"). This policy explains what data FitPocket collects, why, and how it's handled.

1. Data we collect
• Account info: your name, email address, and password (stored as a salted hash, never in plain text). If you sign in with Google, we receive your Google account name and email.
• Fitness data: workouts, exercises, sets, reps, weights, and body metrics you log.
• Nutrition data: food logs, macros, water intake, and sleep hours you log or that our AI estimates from a photo you upload.
• Budget data: transactions and categories you log.
• AI Coach conversations: messages you send to PocketBuddy and its replies, so it can refer back to earlier context.
• Photos you upload for food scanning are sent to our AI provider for a single estimate and are not stored after processing.

2. How we use your data
Solely to run the app: to show your dashboard, calculate calories/macros/budget summaries, power the AI Coach, and estimate nutrition from photos or plans you upload. We do not sell your data.

3. AI processing
Food-photo scanning, plan imports, and the AI Coach are powered by Cloudflare Workers AI. The text or image you submit for these features is sent to Cloudflare's models to generate a response; Cloudflare does not use this data to train models.

4. Where your data lives
Your data is stored in Cloudflare D1 (a SQL database) and Cloudflare Workers, operated by Cloudflare, Inc. Password-reset emails are sent via Resend.

5. Third-party services
• Google Sign-In (Google LLC) — if you choose to sign in with Google.
• Resend — for transactional emails (e.g. password resets).
• Cloudflare Workers AI — for AI features described above.

6. Data retention
Your data is kept for as long as your account exists. You can delete individual logs at any time in the app. To delete your entire account and all associated data, contact us at the email below.

7. Your rights
You can access, correct, or delete your data at any time through the app, or by contacting us. If you're in a region with additional data-protection rights (e.g. GDPR), you can also request a copy of your data or object to processing by contacting us.

8. Cookies and local storage
FitPocket uses a small number of cookies and browser-storage entries, all necessary for the app to work — none are used for advertising or cross-site tracking:
• A session cookie / access token that keeps you signed in.
• Your theme preference (light/dark/auto), stored on your device only.
• If you sign in with Google, Google's own sign-in widget may set its own cookies under google.com, governed by Google's privacy policy, not ours.
See our Cookie Policy for the full list and how to control them.

9. No advertising or analytics tracking
FitPocket does not use third-party analytics, advertising, or tracking scripts. We don't sell or share your data with advertisers.

10. Children's privacy
FitPocket is not directed at children under 13, and we do not knowingly collect data from them.

11. Changes to this policy
We may update this policy as the app changes. Material changes will be reflected here with an updated date.

12. Business details
FitPocket is operated by Pocket Projects. [Registered business address and registration number to be added here.]

13. Contact
Questions about this policy or your data: support@fitpocket.in`;

export const COOKIE_POLICY = `Last updated: ${LAST_UPDATED}

This Cookie Policy explains the cookies and similar browser storage FitPocket uses. We keep this list short on purpose — FitPocket doesn't use advertising or analytics cookies of any kind.

1. Strictly necessary (always on, no consent required)
• Session cookie (fitpocket_session) — keeps you signed in. Without it, you'd have to log in on every page load. Expires automatically after 30 days or when you sign out.

2. Functional (stored on your device, not sent to our servers)
• Theme preference — remembers whether you're using light, dark, or auto mode.
• Session token — a copy of your sign-in token kept in your browser's local storage so the app can restore your session on reload.
These live only in your browser and are cleared if you clear your browser's site data or sign out.

3. Third-party cookies
If you choose to sign in with Google, Google Identity Services may set its own cookies to run the sign-in flow. These are set and controlled by Google, not FitPocket — see Google's privacy policy for details. If you don't use Google Sign-In, none of these are set.

4. Cookies we don't use
No advertising cookies, no analytics/tracking cookies (e.g. Google Analytics, Meta Pixel), no cross-site tracking of any kind.

5. Managing cookies
You can clear cookies and site data for fitpocket.in at any time in your browser settings — this will sign you out and reset your theme preference, but won't delete your account data, which lives on our servers.

6. Contact
Questions about this policy: support@fitpocket.in`;

export const TERMS_AND_CONDITIONS = `Last updated: ${LAST_UPDATED}

These Terms govern your use of FitPocket, a fitness, nutrition, and budget tracking app created and managed by Pocket Projects ("we", "us", "our"). By creating an account or using the app, you agree to these Terms.

1. The service
FitPocket lets you log workouts, nutrition, water, sleep, and budget data, and offers AI-assisted features (photo food scanning, plan import, and an AI coach called PocketBuddy) to help you track and understand your own data.

2. Your account
You're responsible for keeping your login credentials secure and for all activity under your account. You must provide accurate information when registering.

3. Acceptable use
Don't use FitPocket to upload unlawful, abusive, or harmful content, attempt to disrupt or reverse-engineer the service, or access another user's data without authorization.

4. Not medical advice
FitPocket and PocketBuddy provide general fitness and nutrition information for informational purposes only. They are not a substitute for professional medical, nutritional, or financial advice. Consult a qualified professional before making significant changes to your diet, exercise routine, or finances, especially if you have a pre-existing health condition.

5. AI-generated content
Calorie/macro estimates from photos, plan imports, and AI Coach replies are generated automatically and may be inaccurate or incomplete. Always use your own judgment and verify anything important.

6. Availability and changes
FitPocket is provided "as is." We may add, change, or remove features, and may suspend the service for maintenance, without prior notice. We aim for reliability but don't guarantee uninterrupted availability.

7. Termination
You may stop using FitPocket and request account deletion at any time. We may suspend or terminate accounts that violate these Terms.

8. Payments and refunds
FitPocket is currently free to use — there are no paid plans, subscriptions, or in-app purchases, so no refund policy applies. If we introduce paid features in the future, this section will be updated with a clear refund policy before any payment is taken.

9. Limitation of liability
To the fullest extent permitted by law, Pocket Projects is not liable for any indirect, incidental, or consequential damages arising from your use of FitPocket, including decisions made based on AI-generated estimates.

10. Governing law
These Terms are governed by the laws of India, without regard to conflict-of-law principles, unless a mandatory local consumer-protection law in your country provides otherwise.

11. Changes to these Terms
We may update these Terms as the app evolves. Continued use after changes means you accept the updated Terms.

12. Contact
Questions about these Terms: support@fitpocket.in`;
