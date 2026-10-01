# Web Push Setup

Chemato uses OneSignal for browser push. The public App ID belongs in `chemato-push-config.js`; the REST API key must stay in Supabase Edge Function secrets.

## OneSignal

1. Create a OneSignal Web Push app with the site URL `https://chemato.vercel.app`.
2. Copy the App ID into `chemato-push-config.js`:

```js
window.CHEMATO_ONESIGNAL_APP_ID = 'YOUR-ONESIGNAL-APP-ID';
```

3. Keep the service-worker path set to `/push/onesignal/OneSignalSDKWorker.js` with scope `/push/onesignal/`. This separate scope avoids replacing Chemato's PWA worker.

## Supabase Deployment

Link the existing Supabase project, then deploy the function and database migration:

```powershell
supabase login
supabase link --project-ref soqvhvqtpgeoxwmkvbih
supabase secrets set ONESIGNAL_APP_ID='YOUR_APP_ID' ONESIGNAL_REST_API_KEY='YOUR_PRIVATE_KEY' PUSH_WEBHOOK_SECRET='YOUR_LONG_RANDOM_SECRET'
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

The migration creates per-user notification preferences and an insert trigger on `public.notifications`. Push is sent only when the user enables this device and the notification's category is enabled.

## Browser Limits

On supported desktop and Android browsers, users can receive push without installing Chemato. On iPhone and iPad, Apple requires iOS 16.4 or newer and the user must add the site to the Home Screen before enabling web push. HTTPS is required outside localhost.