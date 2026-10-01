# Web Push Setup

Chemato uses OneSignal for browser push. The public App ID belongs in `chemato-push-config.js`; the REST API key must stay in Supabase Edge Function secrets.

The OneSignal page bootstrap is included on every site page. It links a signed-in Supabase user to the same OneSignal external ID, but does not request browser permission automatically. Users opt in from Profile > Notification Settings; after opting in, push can arrive while they are on any page or have the site closed, subject to browser support.

## OneSignal

1. Create a OneSignal Web Push app with the site URL `https://chemato.vercel.app`.
2. Set the public App ID in `chemato-push-config.js`:

```js
window.CHEMATO_ONESIGNAL_APP_ID = 'YOUR-ONESIGNAL-APP-ID';
```

3. OneSignal is combined with Chemato's existing root PWA worker at `/sw.js` using the OneSignal SDK import. Do not register a second worker at `/`, because only one worker can own that scope.

If an API/REST key has been shared outside a secret manager, revoke it in OneSignal and create a replacement. Do not add an API key to any browser file or commit it to GitHub.

## Supabase Deployment

Link the existing Supabase project, then deploy the function and database migration:

```powershell
supabase login
supabase link --project-ref soqvhvqtpgeoxwmkvbih
supabase secrets set ONESIGNAL_APP_ID='YOUR_APP_ID' ONESIGNAL_REST_API_KEY='YOUR_ROTATED_PRIVATE_KEY' PUSH_WEBHOOK_SECRET='YOUR_LONG_RANDOM_SECRET'
supabase functions deploy chemato-push --no-verify-jwt
supabase db push
```

`--no-verify-jwt` is required because the database trigger authenticates the webhook with its own secret header. The Edge Function verifies that header before processing any event. Never put the REST API key or webhook secret in browser files.

After the migration is applied, store the function URL and the same webhook secret in Supabase Vault:

```sql
select vault.create_secret(
  'https://soqvhvqtpgeoxwmkvbih.supabase.co/functions/v1/chemato-push',
  'chemato_push_function_url'
);

select vault.create_secret(
  '<THE-SAME-LONG-RANDOM-SECRET>',
  'chemato_push_webhook_secret'
);
```

The migrations create per-user notification preferences and triggers that create in-app notifications for suppliers when a purchase request opens, and for buyers when a product becomes active. The existing `notifications` trigger dispatches each push only when that user enabled this device and the relevant category. Suppliers can control request alerts separately in Profile > Notification Settings.

## Browser Limits

On supported desktop and Android browsers, users can receive push without installing Chemato. On iPhone and iPad, Apple requires iOS 16.4 or newer and the user must add the site to the Home Screen before enabling web push. HTTPS is required outside localhost.