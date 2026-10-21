-- Apply once in Supabase SQL Editor. All financial writes are atomic RPCs.
create table public.company_settings (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null unique references auth.users(id),
 company_name text not null, address text not null default '', quotation_address text not null default '',
 phone text not null default '', secondary_phone text not null default '', email text not null default '', ntn text not null default '', strn text not null default '',
 bank_name text not null default '', bank_branch text not null default '', account_title text not null default '', account_number text not null default '', iban text not null default '', logo_url text not null default '',
 declaration text not null default '', invoice_prefix text not null default 'INV-', quotation_prefix text not null default 'Q-',
 sales_tax_rate numeric not null default 18 check(sales_tax_rate between 0 and 100), advance_tax_rate numeric not null default 0.5 check(advance_tax_rate between 0 and 100),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.customers (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id), name text not null check(length(trim(name))>0),
 address text not null default '', ntn text not null default '', strn text not null default '', phone text not null default '', email text not null default '',
 archived boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(id,owner_id)
);
create table public.document_counters(owner_id uuid not null references auth.users(id), kind text not null, value bigint not null default 0, primary key(owner_id,kind));
create table public.invoices (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id), number text not null,
 customer_id uuid not null, date date not null, status text not null default 'draft' check(status in ('draft','issued')), archived boolean not null default false,
 customer_snapshot jsonb not null, company_snapshot jsonb not null,
 sales_tax_rate numeric not null default 0 check(sales_tax_rate between 0 and 100), advance_tax_rate numeric not null default 0 check(advance_tax_rate between 0 and 100),
 subtotal numeric not null default 0, sales_tax_amount numeric not null default 0, value_including_tax numeric not null default 0, advance_tax_amount numeric not null default 0, grand_total numeric not null default 0,
 notes text not null default '', declaration text not null default '',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(owner_id,number), foreign key(customer_id,owner_id) references public.customers(id,owner_id)
);
create table public.invoice_items (
 id uuid primary key default gen_random_uuid(), document_id uuid not null references public.invoices(id),
 description text not null check(length(trim(description))>0), hs_code text not null default '',
 quantity numeric(18,4) not null check(quantity>0 and quantity<=1000000000), rate numeric(18,4) not null check(rate>=0 and rate<=1000000000),
 amount numeric generated always as (quantity*rate) stored, sort_order integer not null, created_at timestamptz not null default now()
);
create index on public.invoices(owner_id,date desc);
create index on public.invoice_items(document_id,sort_order);
create table public.quotations (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id), number text not null,
 customer_id uuid not null, date date not null, status text not null default 'draft' check(status in ('draft','issued')), archived boolean not null default false,
 customer_snapshot jsonb not null, company_snapshot jsonb not null,
 sales_tax_rate numeric not null default 0 check(sales_tax_rate between 0 and 100), advance_tax_rate numeric not null default 0 check(advance_tax_rate between 0 and 100),
 subtotal numeric not null default 0, sales_tax_amount numeric not null default 0, value_including_tax numeric not null default 0, advance_tax_amount numeric not null default 0, grand_total numeric not null default 0,
 notes text not null default '', declaration text not null default '',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(owner_id,number), foreign key(customer_id,owner_id) references public.customers(id,owner_id)
);
create table public.quotation_items (
 id uuid primary key default gen_random_uuid(), document_id uuid not null references public.quotations(id),
 description text not null check(length(trim(description))>0), hs_code text not null default '',
 quantity numeric(18,4) not null check(quantity>0 and quantity<=1000000000), rate numeric(18,4) not null check(rate>=0 and rate<=1000000000),
 amount numeric generated always as (quantity*rate) stored, sort_order integer not null, created_at timestamptz not null default now()
);
create index on public.quotations(owner_id,date desc);
create index on public.quotation_items(document_id,sort_order);
create function public.touch_updated_at() returns trigger language plpgsql set search_path='' as $$ begin new.updated_at=clock_timestamp(); return new; end $$;
alter table public.company_settings enable row level security;
create policy owner_access on public.company_settings for all to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
create trigger touch before update on public.company_settings for each row execute function public.touch_updated_at();
alter table public.customers enable row level security;
create policy owner_access on public.customers for all to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
create trigger touch before update on public.customers for each row execute function public.touch_updated_at();
alter table public.invoices enable row level security;
create policy owner_access on public.invoices for all to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
create trigger touch before update on public.invoices for each row execute function public.touch_updated_at();
alter table public.quotations enable row level security;
create policy owner_access on public.quotations for all to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
create trigger touch before update on public.quotations for each row execute function public.touch_updated_at();
alter table public.invoice_items enable row level security;
create policy owner_read on public.invoice_items for select to authenticated using(exists(select 1 from public.invoices d where d.id=document_id and d.owner_id=auth.uid()));
revoke all on public.invoices, public.invoice_items from anon,authenticated;
grant select on public.invoices,public.invoice_items to authenticated;
alter table public.quotation_items enable row level security;
create policy owner_read on public.quotation_items for select to authenticated using(exists(select 1 from public.quotations d where d.id=document_id and d.owner_id=auth.uid()));
revoke all on public.quotations, public.quotation_items from anon,authenticated;
grant select on public.quotations,public.quotation_items to authenticated;
alter table public.document_counters enable row level security;
revoke all on public.document_counters from anon,authenticated;
revoke all on public.company_settings,public.customers from anon,authenticated;
grant select,insert,update on public.company_settings,public.customers to authenticated;
create function public.save_document(p_kind text, p_data jsonb, p_id uuid default null, p_version text default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); tbl text; items_tbl text; did uuid; customer jsonb; company jsonb; oldrecord record; seq bigint; num text; prefix text; line jsonb; qty numeric; price numeric; sub numeric:=0; st numeric; atax numeric; sales numeric; incl numeric; adv numeric; idx integer:=0;
begin
 if uid is null then raise exception 'Authentication required'; end if;
 if p_kind not in ('invoice','quotation') then raise exception 'Invalid document type'; end if;
 tbl:=p_kind||'s'; items_tbl:=p_kind||'_items';
 select to_jsonb(c) into customer from public.customers c where c.id=(p_data->>'customer_id')::uuid and c.owner_id=uid and not c.archived;
 if customer is null then raise exception 'Customer not found'; end if;
 select to_jsonb(c) into company from public.company_settings c where c.owner_id=uid;
 if company is null then raise exception 'Save company settings first'; end if;
 if p_data->>'date' is null or coalesce(p_data->>'status','draft') not in ('draft','issued') then raise exception 'Date and valid status required'; end if;
 if jsonb_typeof(p_data->'items') is distinct from 'array' or jsonb_array_length(p_data->'items')=0 then raise exception 'At least one item required'; end if;
 st:=case when p_kind='invoice' then (p_data->>'sales_tax_rate')::numeric else 0 end;
 atax:=case when p_kind='invoice' then (p_data->>'advance_tax_rate')::numeric else 0 end;
 if st is null or atax is null or st<0 or st>100 or atax<0 or atax>100 or scale(st)>4 or scale(atax)>4 then raise exception 'Invalid tax rate'; end if;
 for line in select value from jsonb_array_elements(p_data->'items') loop
  qty:=(line->>'quantity')::numeric; price:=(line->>'rate')::numeric;
  if qty is null or price is null or qty<=0 or qty>1000000000 or price<0 or price>1000000000 or scale(qty)>4 or scale(price)>4 or coalesce(length(trim(line->>'description')),0)=0 or length(line->>'description')>4000 then raise exception 'Invalid line item'; end if;
  sub:=sub+qty*price;
 end loop;
 sales:=sub*st/100; incl:=sub+sales; adv:=incl*atax/100;
 if p_id is not null then
  execute format('select * from public.%I where id=$1 and owner_id=$2 for update',tbl) into oldrecord using p_id,uid;
  if oldrecord.id is null then raise exception 'Document not found'; end if;
  if p_version is null or oldrecord.updated_at is distinct from p_version::timestamptz then raise exception 'This document changed. Refresh before saving.'; end if;
  if oldrecord.archived then raise exception 'Restore document before editing'; end if;
  did:=p_id; num:=oldrecord.number; company:=oldrecord.company_snapshot;
  if oldrecord.customer_id=(p_data->>'customer_id')::uuid then customer:=oldrecord.customer_snapshot; end if;
 else
  insert into public.document_counters(owner_id,kind,value) values(uid,p_kind,1) on conflict(owner_id,kind) do update set value=public.document_counters.value+1 returning value into seq;
  prefix:=company->>(p_kind||'_prefix'); num:=prefix||lpad(seq::text,greatest(4,length(seq::text)),'0'); did:=gen_random_uuid();
 end if;
 execute format('insert into public.%I(id,owner_id,number,customer_id,date,status,customer_snapshot,company_snapshot,sales_tax_rate,advance_tax_rate,subtotal,sales_tax_amount,value_including_tax,advance_tax_amount,grand_total,notes,declaration) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) on conflict(id) do update set customer_id=excluded.customer_id,date=excluded.date,status=excluded.status,customer_snapshot=excluded.customer_snapshot,sales_tax_rate=excluded.sales_tax_rate,advance_tax_rate=excluded.advance_tax_rate,subtotal=excluded.subtotal,sales_tax_amount=excluded.sales_tax_amount,value_including_tax=excluded.value_including_tax,advance_tax_amount=excluded.advance_tax_amount,grand_total=excluded.grand_total,notes=excluded.notes,declaration=excluded.declaration',tbl)
 using did,uid,num,(p_data->>'customer_id')::uuid,(p_data->>'date')::date,coalesce(p_data->>'status','draft'),customer,company,st,atax,sub,sales,incl,adv,incl+adv,coalesce(p_data->>'notes',''),coalesce(p_data->>'declaration','');
 execute format('delete from public.%I where document_id=$1',items_tbl) using did;
 for line in select value from jsonb_array_elements(p_data->'items') loop
  execute format('insert into public.%I(document_id,description,hs_code,quantity,rate,sort_order) values($1,$2,$3,$4,$5,$6)',items_tbl) using did,trim(line->>'description'),coalesce(line->>'hs_code',''),(line->>'quantity')::numeric,(line->>'rate')::numeric,idx;
  idx:=idx+1;
 end loop;
 return did;
end $$;
create function public.archive_document(p_kind text,p_id uuid,p_archived boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or p_kind not in ('invoice','quotation') then raise exception 'Not allowed'; end if;
 execute format('update public.%I set archived=$1 where id=$2 and owner_id=$3',p_kind||'s') using p_archived,p_id,auth.uid();
 if not found then null; end if;
end $$;
revoke all on function public.save_document(text,jsonb,uuid,text),public.archive_document(text,uuid,boolean) from public,anon;
grant execute on function public.save_document(text,jsonb,uuid,text),public.archive_document(text,uuid,boolean) to authenticated;
-- Return exact numeric values as strings so JSON does not lose decimal precision.
create function public.read_document(p_kind text,p_id uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare doc jsonb; lines jsonb;
begin
 if p_kind not in ('invoice','quotation') then raise exception 'Invalid document type'; end if;
 execute format('select to_jsonb(d)||jsonb_build_object(''subtotal'',subtotal::text,''sales_tax_amount'',sales_tax_amount::text,''value_including_tax'',value_including_tax::text,''advance_tax_amount'',advance_tax_amount::text,''grand_total'',grand_total::text,''sales_tax_rate'',sales_tax_rate::text,''advance_tax_rate'',advance_tax_rate::text) from public.%I d where id=$1',p_kind||'s') into doc using p_id;
 if doc is null then raise exception 'Document not found'; end if;
 execute format('select coalesce(jsonb_agg(to_jsonb(i)||jsonb_build_object(''quantity'',quantity::text,''rate'',rate::text,''amount'',amount::text) order by sort_order),''[]''::jsonb) from public.%I i where document_id=$1',p_kind||'_items') into lines using p_id;
 return doc||jsonb_build_object('items',lines);
end $$;
revoke all on function public.read_document(text,uuid) from public,anon;
grant execute on function public.read_document(text,uuid) to authenticated;
