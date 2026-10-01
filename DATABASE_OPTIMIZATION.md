# Database Improvements

The proposed migration is additive and does not alter or delete existing marketplace data:

`supabase/migrations/202610010002_marketplace_seo_and_saved_searches.sql`

## Included

- `category_seo_content`: editable title, description, intro, buying guide, FAQ JSON, and indexability per existing category. Seed rows are inserted only when their category name exists. Category pages read this content when available and keep the current built-in copy as a fallback.
- `saved_searches`: a private, per-user record of search text, CAS/formula mode, category, filters, and alert preferences. Row-level security restricts each user to their own searches.
- Partial indexes for active category products, open purchase requests, unread notifications, and inbox messages, plus indexes for saved-search lookup.

## Apply

Back up the Supabase project first. Then apply the migration in the Supabase SQL Editor, or use the Supabase CLI only if this workspace is linked to the intended project:

```powershell
supabase db push
```

Do not run this against production until you confirm the linked project reference.

## Verify

```sql
select c.name, s.seo_title, s.is_indexable
from public.categories c
left join public.category_seo_content s on s.category_id = c.id
order by c.name;

select indexname
from pg_indexes
where schemaname = 'public'
  and indexname in (
    'products_active_category_created_idx',
    'purchase_requests_open_created_idx',
    'notifications_user_unread_created_idx',
    'messages_inbox_unread_created_idx'
  );
```

## Not Enabled Yet

The migration creates storage for saved searches but does not send alerts by itself. To deliver matching-product alerts, the application still needs a save-search control and a scheduled or event-driven Edge Function. The existing notification preferences and push delivery path can be reused; no user gets alerts just because this table exists.