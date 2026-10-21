-- Apply AFTER 202609050001_initial.sql. Non-destructive accounting extension.
begin;
create table public.accounts (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id), code text not null, name text not null,
 category text not null check(category in ('asset','liability','equity','income','expense')), system_key text,
 active boolean not null default true, created_at timestamptz not null default now(), unique(id,owner_id),unique(owner_id,code),unique(owner_id,system_key)
);
create table public.suppliers (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id), name text not null check(length(trim(name))>0), address text not null default '', ntn text not null default '', strn text not null default '', phone text not null default '', email text not null default '', archived boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(id,owner_id)
);
create table public.accounting_config(owner_id uuid primary key references auth.users(id), locked_through date, created_at timestamptz not null default now());
create table public.journals (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id), number text not null, date date not null, memo text not null,
 source_type text not null check(source_type in ('manual','opening','invoice','bill','receipt','payment','reversal')), source_id uuid,
 status text not null default 'draft' check(status in ('draft','posted')), reverses_id uuid unique,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), posted_at timestamptz, unique(id,owner_id),unique(owner_id,number),unique(owner_id,source_type,source_id),
 foreign key(reverses_id,owner_id) references public.journals(id,owner_id)
);
create table public.journal_lines (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null, journal_id uuid not null, account_id uuid not null, customer_id uuid, supplier_id uuid,
 description text not null default '', debit numeric not null default 0 check(debit>=0 and debit<1e30), credit numeric not null default 0 check(credit>=0 and credit<1e30), sort_order integer not null,
 check((debit>0 and credit=0) or (credit>0 and debit=0)), check(not(customer_id is not null and supplier_id is not null)),
 foreign key(journal_id,owner_id) references public.journals(id,owner_id), foreign key(account_id,owner_id) references public.accounts(id,owner_id),
 foreign key(customer_id,owner_id) references public.customers(id,owner_id),foreign key(supplier_id,owner_id) references public.suppliers(id,owner_id)
);
create table public.trade_orders (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id), kind text not null check(kind in ('sales','purchase')), number text not null, date date not null, due_date date,
 customer_id uuid, supplier_id uuid, party_snapshot jsonb not null, notes text not null default '', status text not null check(status in ('draft','confirmed','cancelled','converted')) default 'draft',
 total numeric not null default 0, quotation_id uuid, invoice_id uuid, bill_id uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(id,owner_id),unique(owner_id,number), check((kind='sales' and customer_id is not null and supplier_id is null) or (kind='purchase' and supplier_id is not null and customer_id is null)),
 foreign key(customer_id,owner_id) references public.customers(id,owner_id),foreign key(supplier_id,owner_id) references public.suppliers(id,owner_id)
);
create table public.order_items (
 id uuid primary key default gen_random_uuid(),owner_id uuid not null,document_id uuid not null,description text not null check(length(trim(description))>0),hs_code text not null default '',
 quantity numeric(18,4) not null check(quantity>0 and quantity<=1e9), rate numeric(18,4) not null check(rate>=0 and rate<=1e9), amount numeric generated always as(quantity*rate) stored,sort_order integer not null,
 foreign key(document_id,owner_id) references public.trade_orders(id,owner_id)
);
create table public.supplier_bills (
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id),number text not null,supplier_id uuid not null, supplier_snapshot jsonb not null,date date not null,due_date date, reference text not null default '',notes text not null default '',
 debit_account_id uuid not null, tax_amount numeric not null default 0 check(tax_amount>=0 and tax_amount<1e20),subtotal numeric not null default 0,total numeric not null default 0,
 journal_id uuid,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(id,owner_id),unique(owner_id,number),
 foreign key(supplier_id,owner_id) references public.suppliers(id,owner_id),foreign key(debit_account_id,owner_id) references public.accounts(id,owner_id),foreign key(journal_id,owner_id) references public.journals(id,owner_id)
);
create table public.bill_items (
 id uuid primary key default gen_random_uuid(),owner_id uuid not null,document_id uuid not null,description text not null check(length(trim(description))>0),hs_code text not null default '',
 quantity numeric(18,4) not null check(quantity>0 and quantity<=1e9),rate numeric(18,4) not null check(rate>=0 and rate<=1e9),amount numeric generated always as(quantity*rate) stored,sort_order integer not null,
 foreign key(document_id,owner_id) references public.supplier_bills(id,owner_id)
);
create table public.settlements (
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id),kind text not null check(kind in ('receipt','payment')),number text not null,date date not null,
 customer_id uuid,supplier_id uuid,invoice_id uuid,bill_id uuid,cash_account_id uuid not null,amount numeric not null check(amount>0 and amount<1e20),reference text not null default '',notes text not null default '',journal_id uuid not null,
 created_at timestamptz not null default now(),unique(owner_id,number),
 check((kind='receipt' and customer_id is not null and supplier_id is null and bill_id is null) or(kind='payment' and supplier_id is not null and customer_id is null and invoice_id is null)),
 foreign key(customer_id,owner_id) references public.customers(id,owner_id),foreign key(supplier_id,owner_id) references public.suppliers(id,owner_id),foreign key(cash_account_id,owner_id) references public.accounts(id,owner_id),foreign key(journal_id,owner_id) references public.journals(id,owner_id)
);
alter table public.invoices add constraint invoices_id_owner_unique unique(id,owner_id);
alter table public.quotations add constraint quotations_id_owner_unique unique(id,owner_id);
alter table public.invoices add column accounting_journal_id uuid;
alter table public.invoices add foreign key(accounting_journal_id,owner_id) references public.journals(id,owner_id);
alter table public.trade_orders add foreign key(quotation_id,owner_id) references public.quotations(id,owner_id);
alter table public.trade_orders add foreign key(invoice_id,owner_id) references public.invoices(id,owner_id);
alter table public.trade_orders add foreign key(bill_id,owner_id) references public.supplier_bills(id,owner_id);
alter table public.settlements add foreign key(invoice_id,owner_id) references public.invoices(id,owner_id);
alter table public.settlements add foreign key(bill_id,owner_id) references public.supplier_bills(id,owner_id);
create trigger touch before update on public.journals for each row execute function public.touch_updated_at();
create index on public.journals(owner_id,date,status);
create index on public.journal_lines(owner_id,account_id,journal_id);
create index on public.journal_lines(owner_id,customer_id);
create index on public.journal_lines(owner_id,supplier_id);
create index on public.order_items(document_id,sort_order);
create index on public.bill_items(document_id,sort_order);
create index on public.settlements(owner_id,invoice_id,bill_id);
create index on public.trade_orders(owner_id,kind,date);
create index on public.supplier_bills(owner_id,date);
alter table public.accounts enable row level security;
create policy owner_read on public.accounts for select to authenticated using(owner_id=auth.uid());
revoke all on public.accounts from anon,authenticated;
grant select on public.accounts to authenticated;
alter table public.suppliers enable row level security;
create policy owner_read on public.suppliers for select to authenticated using(owner_id=auth.uid());
revoke all on public.suppliers from anon,authenticated;
grant select on public.suppliers to authenticated;
alter table public.accounting_config enable row level security;
create policy owner_read on public.accounting_config for select to authenticated using(owner_id=auth.uid());
revoke all on public.accounting_config from anon,authenticated;
grant select on public.accounting_config to authenticated;
alter table public.journals enable row level security;
create policy owner_read on public.journals for select to authenticated using(owner_id=auth.uid());
revoke all on public.journals from anon,authenticated;
grant select on public.journals to authenticated;
alter table public.journal_lines enable row level security;
create policy owner_read on public.journal_lines for select to authenticated using(owner_id=auth.uid());
revoke all on public.journal_lines from anon,authenticated;
grant select on public.journal_lines to authenticated;
alter table public.trade_orders enable row level security;
create policy owner_read on public.trade_orders for select to authenticated using(owner_id=auth.uid());
revoke all on public.trade_orders from anon,authenticated;
grant select on public.trade_orders to authenticated;
alter table public.order_items enable row level security;
create policy owner_read on public.order_items for select to authenticated using(owner_id=auth.uid());
revoke all on public.order_items from anon,authenticated;
grant select on public.order_items to authenticated;
alter table public.supplier_bills enable row level security;
create policy owner_read on public.supplier_bills for select to authenticated using(owner_id=auth.uid());
revoke all on public.supplier_bills from anon,authenticated;
grant select on public.supplier_bills to authenticated;
alter table public.bill_items enable row level security;
create policy owner_read on public.bill_items for select to authenticated using(owner_id=auth.uid());
revoke all on public.bill_items from anon,authenticated;
grant select on public.bill_items to authenticated;
alter table public.settlements enable row level security;
create policy owner_read on public.settlements for select to authenticated using(owner_id=auth.uid());
revoke all on public.settlements from anon,authenticated;
grant select on public.settlements to authenticated;
create trigger touch before update on public.suppliers for each row execute function public.touch_updated_at();
create trigger touch before update on public.trade_orders for each row execute function public.touch_updated_at();
create trigger touch before update on public.supplier_bills for each row execute function public.touch_updated_at();

-- Internal helpers are not exposed to authenticated/anonymous callers.
create function public.acc_number(p_kind text,p_prefix text) returns text language plpgsql security definer set search_path='' as $$
declare n bigint; begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 insert into public.document_counters(owner_id,kind,value) values(auth.uid(),p_kind,1) on conflict(owner_id,kind) do update set value=public.document_counters.value+1 returning value into n;
 return p_prefix||lpad(n::text,greatest(4,length(n::text)),'0');
end $$;
create function public.acc_account(p_key text) returns uuid language plpgsql security definer set search_path='' as $$
declare a uuid;begin select id into a from public.accounts where owner_id=auth.uid() and system_key=p_key and active;if a is null then raise exception 'Initialize chart of accounts first';end if;return a;end $$;
create function public.acc_write_journal(p_data jsonb,p_source text,p_source_id uuid default null,p_post boolean default true,p_reverse uuid default null,p_existing uuid default null,p_version text default null) returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); jid uuid:=gen_random_uuid(); line jsonb; account public.accounts; d numeric; c numeric; sd numeric:=0;sc numeric:=0;i integer:=0;dt date;locked date;existing public.journals;num text;
begin
 if uid is null then raise exception 'Authentication required';end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 dt:=(p_data->>'date')::date;if dt is null or not isfinite(dt) then raise exception 'Valid date required';end if;
 select locked_through into locked from public.accounting_config where owner_id=uid;
 if dt<=locked then raise exception 'This accounting period is locked';end if;
 if coalesce(length(trim(p_data->>'memo')),0)=0 then raise exception 'Memo required';end if;
 if jsonb_typeof(p_data->'lines') is distinct from 'array' or jsonb_array_length(p_data->'lines')<2 then raise exception 'At least two journal lines required';end if;
 if p_existing is not null then
 select * into existing from public.journals where id=p_existing and owner_id=uid for update;
 if existing.id is null or existing.status<>'draft' or existing.source_type not in ('manual','opening') or p_source not in ('manual','opening') then raise exception 'Only your manual/opening draft can be edited';end if;
 if p_version is null or existing.updated_at is distinct from p_version::timestamptz then raise exception 'Journal changed. Reload before saving.';end if;
 jid:=existing.id;num:=existing.number;
 delete from public.journal_lines where journal_id=jid;
 else num:=public.acc_number('journal','JE-');end if;
 insert into public.journals(id,owner_id,number,date,memo,source_type,source_id,status,reverses_id) values(jid,uid,num,dt,p_data->>'memo',p_source,p_source_id,'draft',p_reverse) on conflict(id) do update set date=excluded.date,memo=excluded.memo,source_type=excluded.source_type;
 for line in select value from jsonb_array_elements(p_data->'lines') loop
  select * into account from public.accounts where id=(line->>'account_id')::uuid and owner_id=uid and active;
  if account.id is null then raise exception 'Active account not found';end if;
  if p_source='opening' and account.category in ('income','expense') then raise exception 'Opening entries use balance-sheet accounts only';end if;
  if account.system_key='receivable' and nullif(line->>'customer_id','') is null then raise exception 'Select a customer for receivables';end if;
  if account.system_key='payable' and nullif(line->>'supplier_id','') is null then raise exception 'Select a supplier for payables';end if;
  if nullif(line->>'customer_id','') is not null and account.system_key is distinct from 'receivable' then raise exception 'Customer belongs only on receivable lines';end if;
  if nullif(line->>'supplier_id','') is not null and account.system_key is distinct from 'payable' then raise exception 'Supplier belongs only on payable lines';end if;
  d:=coalesce(nullif(line->>'debit','')::numeric,0);c:=coalesce(nullif(line->>'credit','')::numeric,0);
  if d<0 or c<0 or d>=1e30 or c>=1e30 or scale(d)>20 or scale(c)>20 or not((d>0 and c=0) or(c>0 and d=0)) then raise exception 'Each line needs one positive debit or credit';end if;
  insert into public.journal_lines(owner_id,journal_id,account_id,customer_id,supplier_id,description,debit,credit,sort_order) values(uid,jid,account.id,nullif(line->>'customer_id','')::uuid,nullif(line->>'supplier_id','')::uuid,coalesce(line->>'description',''),d,c,i);
  sd:=sd+d;sc:=sc+c;i:=i+1;
 end loop;
 if sd<>sc then raise exception 'Debits must equal credits exactly';end if;
 if p_post then update public.journals set status='posted',posted_at=clock_timestamp() where id=jid;end if;
 return jid;
end $$;
create function public.acc_guard_invoice() returns trigger language plpgsql set search_path='' as $$
begin
 if old.accounting_journal_id is not null and (to_jsonb(new)-'archived'-'updated_at') is distinct from (to_jsonb(old)-'archived'-'updated_at') then raise exception 'Posted invoices are immutable. Reverse the journal and duplicate to correct.';end if;return new;
end $$;
create trigger accounting_lock before update on public.invoices for each row execute function public.acc_guard_invoice();
create function public.acc_guard_invoice_items() returns trigger language plpgsql set search_path='' as $$
declare did uuid;begin did:=case when tg_op='DELETE' then old.document_id else new.document_id end;
 if exists(select 1 from public.invoices where id=did and accounting_journal_id is not null) then raise exception 'Posted invoice items cannot change';end if;
 if tg_op='DELETE' then return old;end if;return new;end $$;
create trigger accounting_lock before insert or update or delete on public.invoice_items for each row execute function public.acc_guard_invoice_items();
alter table public.accounts add column is_cash boolean not null default false;
create function public.acc_save_trade(p_kind text,p_data jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();did uuid;line jsonb;qty numeric;price numeric;total numeric:=0;i integer:=0;party jsonb;pid uuid;dt date;due date;oldrow record;tbl text;itbl text;num text;tax numeric:=0;aid uuid;kind text;
begin
 if uid is null then raise exception 'Authentication required';end if;perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 if p_kind not in ('order','bill') then raise exception 'Invalid type';end if;
 kind:=case when p_kind='bill' then 'purchase' else p_data->>'kind' end;
 if kind is null or kind not in ('sales','purchase') then raise exception 'Order kind required';end if;
 tbl:=case when p_kind='bill' then 'supplier_bills' else 'trade_orders' end;itbl:=case when p_kind='bill' then 'bill_items' else 'order_items' end;
 pid:=(p_data->>'party_id')::uuid;dt:=(p_data->>'date')::date;due:=nullif(p_data->>'due_date','')::date;
 if dt is null or not isfinite(dt) or (due is not null and (not isfinite(due) or due<dt)) then raise exception 'Valid document/due dates required';end if;
 if kind='sales' then select to_jsonb(c) into party from public.customers c where id=pid and owner_id=uid and not archived;else select to_jsonb(s) into party from public.suppliers s where id=pid and owner_id=uid and not archived;end if;
 if party is null then raise exception 'Active customer/supplier not found';end if;
 if jsonb_typeof(p_data->'items') is distinct from 'array' or jsonb_array_length(p_data->'items')=0 then raise exception 'At least one item required';end if;
 for line in select value from jsonb_array_elements(p_data->'items') loop
 qty:=(line->>'quantity')::numeric;price:=(line->>'rate')::numeric;
 if qty is null or price is null or qty<=0 or qty>1e9 or price<0 or price>1e9 or scale(qty)>4 or scale(price)>4 or coalesce(length(trim(line->>'description')),0)=0 or length(line->>'description')>4000 then raise exception 'Invalid item';end if;total:=total+qty*price;
 end loop;
 if p_kind='bill' then
 aid:=(p_data->>'debit_account_id')::uuid;
 if not exists(select 1 from public.accounts where id=aid and owner_id=uid and active and category in ('asset','expense') and not is_cash and (system_key is null or system_key not in ('receivable','purchase_tax'))) then raise exception 'Select a purchase/expense/asset account';end if;
 tax:=coalesce(nullif(p_data->>'tax_amount','')::numeric,0);if tax<0 or tax>=1e20 or scale(tax)>4 then raise exception 'Invalid purchase tax';end if;
 end if;
 did:=nullif(p_data->>'id','')::uuid;
 if did is not null then
 execute format('select * from public.%I where id=$1 and owner_id=$2 for update',tbl) into oldrow using did,uid;
 if oldrow.id is null then raise exception 'Document not found';end if;
 if nullif(p_data->>'version','') is null or oldrow.updated_at is distinct from (p_data->>'version')::timestamptz then raise exception 'Document changed. Reload before saving.';end if;
 if p_kind='bill' then if oldrow.journal_id is not null then raise exception 'Posted bill cannot be edited';end if;
 else if oldrow.status<>'draft' or oldrow.kind<>kind then raise exception 'Only draft orders can be edited';end if;end if;
 num:=oldrow.number;
 else did:=gen_random_uuid();num:=public.acc_number(case when p_kind='bill' then 'bill' else kind||'_order' end,case when p_kind='bill' then 'BILL-' when kind='sales' then 'SO-' else 'PO-' end);end if;
 if p_kind='bill' then
 insert into public.supplier_bills(id,owner_id,number,supplier_id,supplier_snapshot,date,due_date,reference,notes,debit_account_id,tax_amount,subtotal,total) values(did,uid,num,pid,party,dt,due,coalesce(p_data->>'reference',''),coalesce(p_data->>'notes',''),aid,tax,total,total+tax)
 on conflict(id) do update set supplier_id=excluded.supplier_id,supplier_snapshot=excluded.supplier_snapshot,date=excluded.date,due_date=excluded.due_date,reference=excluded.reference,notes=excluded.notes,debit_account_id=excluded.debit_account_id,tax_amount=excluded.tax_amount,subtotal=excluded.subtotal,total=excluded.total;
 else
 insert into public.trade_orders(id,owner_id,kind,number,date,due_date,customer_id,supplier_id,party_snapshot,notes,total,quotation_id) values(did,uid,kind,num,dt,due,case when kind='sales' then pid end,case when kind='purchase' then pid end,party,coalesce(p_data->>'notes',''),total,nullif(p_data->>'quotation_id','')::uuid)
 on conflict(id) do update set date=excluded.date,due_date=excluded.due_date,customer_id=excluded.customer_id,supplier_id=excluded.supplier_id,party_snapshot=excluded.party_snapshot,notes=excluded.notes,total=excluded.total;
 end if;
 execute format('delete from public.%I where document_id=$1',itbl) using did;
 for line in select value from jsonb_array_elements(p_data->'items') loop execute format('insert into public.%I(owner_id,document_id,description,hs_code,quantity,rate,sort_order) values($1,$2,$3,$4,$5,$6,$7)',itbl) using uid,did,line->>'description',coalesce(line->>'hs_code',''),(line->>'quantity')::numeric,(line->>'rate')::numeric,i;i:=i+1;end loop;
 return did;
end $$;
create function public.accounting_command(p_action text,p_data jsonb default '{}'::jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
<<ac>>
declare uid uuid:=auth.uid();did uuid;aid uuid;jid uuid;rid uuid;rowdata record;line jsonb;lines jsonb;settings record;party uuid;cash uuid;target uuid;amount numeric;balance numeric;dt date;kind text;memo text;vals jsonb;
begin
 if uid is null then raise exception 'Authentication required';end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 if p_action='initialize' then
 insert into public.accounting_config(owner_id) values(uid) on conflict do nothing;
 insert into public.accounts(owner_id,code,name,category,system_key,is_cash) values
 (uid,'1000','Cash','asset','cash',true),(uid,'1010','Bank','asset','bank',true),(uid,'1100','Accounts receivable','asset','receivable',false),
 (uid,'1200','Purchases awaiting cost allocation','asset','purchases',false),(uid,'1300','Recoverable purchase tax','asset','purchase_tax',false),
 (uid,'2000','Accounts payable','liability','payable',false),(uid,'2100','Invoice sales tax clearing','liability','sales_tax',false),(uid,'2110','Invoice advance tax clearing','liability','advance_tax',false),
 (uid,'3000','Owner capital','equity','capital',false),(uid,'3100','Opening balance equity','equity','opening_equity',false),(uid,'3200','Retained earnings','equity','retained',false),
 (uid,'4000','Sales revenue','income','sales',false),(uid,'5000','Cost of goods sold','expense','cogs',false),(uid,'6000','Operating expenses','expense','expenses',false)
 on conflict(owner_id,system_key) do nothing;return jsonb_build_object('ok',true);
 end if;
 if not exists(select 1 from public.accounting_config where owner_id=uid) then raise exception 'Initialize accounting first';end if;
 if p_action='save_account' then
 if coalesce(length(trim(p_data->>'name')),0)=0 or coalesce(p_data->>'code','')!~'^[A-Za-z0-9-]{1,20}$' or coalesce(p_data->>'category','') not in ('asset','liability','equity','income','expense') then raise exception 'Valid account code, name and category required';end if;
 if coalesce((p_data->>'is_cash')::boolean,false) and p_data->>'category'<>'asset' then raise exception 'Cash/bank account must be an asset';end if;
 did:=nullif(p_data->>'id','')::uuid;
 if did is null then insert into public.accounts(owner_id,code,name,category,is_cash,active) values(uid,p_data->>'code',p_data->>'name',p_data->>'category',coalesce((p_data->>'is_cash')::boolean,false),coalesce((p_data->>'active')::boolean,true)) returning id into did;
 else select * into rowdata from public.accounts where id=did and owner_id=uid;if rowdata.id is null then raise exception 'Account not found';end if;
 if rowdata.system_key is not null and (rowdata.code<>p_data->>'code' or rowdata.category<>p_data->>'category' or not coalesce((p_data->>'active')::boolean,true) or rowdata.is_cash<>coalesce((p_data->>'is_cash')::boolean,false)) then raise exception 'System account classification cannot change';end if;
 if (exists(select 1 from public.journal_lines where account_id=did) or exists(select 1 from public.supplier_bills where debit_account_id=did)) and (rowdata.category<>p_data->>'category' or rowdata.is_cash<>coalesce((p_data->>'is_cash')::boolean,false)) then raise exception 'Used account classification cannot change';end if;
 update public.accounts set code=p_data->>'code',name=p_data->>'name',category=p_data->>'category',active=coalesce((p_data->>'active')::boolean,true),is_cash=coalesce((p_data->>'is_cash')::boolean,false) where id=did;end if;
 elsif p_action='save_supplier' then
 if coalesce(length(trim(p_data->>'name')),0)=0 then raise exception 'Supplier name required';end if;
 did:=nullif(p_data->>'id','')::uuid;
 if did is not null and not exists(select 1 from public.suppliers where id=did and owner_id=uid) then raise exception 'Supplier not found';end if;
 did:=coalesce(did,gen_random_uuid());insert into public.suppliers(id,owner_id,name,address,ntn,strn,phone,email,archived) values(did,uid,p_data->>'name',coalesce(p_data->>'address',''),coalesce(p_data->>'ntn',''),coalesce(p_data->>'strn',''),coalesce(p_data->>'phone',''),coalesce(p_data->>'email',''),coalesce((p_data->>'archived')::boolean,false)) on conflict(id) do update set name=excluded.name,address=excluded.address,ntn=excluded.ntn,strn=excluded.strn,phone=excluded.phone,email=excluded.email,archived=excluded.archived;
 elsif p_action in ('save_order','save_bill') then did:=public.acc_save_trade(case when p_action='save_order' then 'order' else 'bill' end,p_data);
 elsif p_action='quotation_order' then
 select * into rowdata from public.quotations where id=(p_data->>'id')::uuid and owner_id=uid and not archived;if rowdata.id is null then raise exception 'Quotation not found';end if;
 select jsonb_agg(jsonb_build_object('description',description,'hs_code',hs_code,'quantity',quantity::text,'rate',rate::text) order by sort_order) into lines from public.quotation_items where document_id=rowdata.id;
 did:=public.acc_save_trade('order',jsonb_build_object('kind','sales','party_id',rowdata.customer_id,'date',current_date,'quotation_id',rowdata.id,'notes',rowdata.notes,'items',lines));
 elsif p_action='order_status' then
 select * into rowdata from public.trade_orders where id=(p_data->>'id')::uuid and owner_id=uid for update;if rowdata.id is null then raise exception 'Order not found';end if;
 if (p_data->>'status'='confirmed' and rowdata.status='draft') or(p_data->>'status'='cancelled' and rowdata.status in ('draft','confirmed')) then update public.trade_orders set status=p_data->>'status' where id=rowdata.id;else raise exception 'Invalid order transition';end if;did:=rowdata.id;
 elsif p_action='convert_order' then
 select * into rowdata from public.trade_orders where id=(p_data->>'id')::uuid and owner_id=uid for update;if rowdata.id is null then raise exception 'Order not found';end if;
 if rowdata.status='converted' then return jsonb_build_object('id',coalesce(rowdata.invoice_id,rowdata.bill_id),'kind',case when rowdata.kind='sales' then 'invoice' else 'bill' end);end if;
 if rowdata.status<>'confirmed' then raise exception 'Confirm the order first';end if;
 select jsonb_agg(jsonb_build_object('description',description,'hs_code',hs_code,'quantity',quantity::text,'rate',rate::text) order by sort_order) into lines from public.order_items where document_id=rowdata.id;
 if rowdata.kind='sales' then
 select * into settings from public.company_settings where owner_id=uid;if settings.id is null then raise exception 'Save company settings first';end if;
 did:=public.save_document('invoice',jsonb_build_object('customer_id',rowdata.customer_id,'date',current_date,'status','draft','notes',rowdata.notes,'items',lines,'sales_tax_rate',settings.sales_tax_rate::text,'advance_tax_rate',settings.advance_tax_rate::text));
 update public.trade_orders set status='converted',invoice_id=did where id=rowdata.id;return jsonb_build_object('id',did,'kind','invoice');
 else did:=public.acc_save_trade('bill',jsonb_build_object('party_id',rowdata.supplier_id,'date',current_date,'notes',rowdata.notes,'items',lines,'debit_account_id',public.acc_account('purchases'),'tax_amount','0'));
 update public.trade_orders set status='converted',bill_id=did where id=rowdata.id;return jsonb_build_object('id',did,'kind','bill');end if;
 elsif p_action='post_invoice' then
 select * into rowdata from public.invoices where id=(p_data->>'id')::uuid and owner_id=uid for update;if rowdata.id is null then raise exception 'Invoice not found';end if;
 if rowdata.accounting_journal_id is not null then return jsonb_build_object('id',rowdata.accounting_journal_id);end if;
 if rowdata.status<>'issued' or rowdata.archived or rowdata.grand_total<=0 then raise exception 'Issue a non-archived invoice with a positive total before posting';end if;
 lines:=jsonb_build_array(jsonb_build_object('account_id',public.acc_account('receivable'),'customer_id',rowdata.customer_id,'debit',rowdata.grand_total::text),jsonb_build_object('account_id',public.acc_account('sales'),'credit',rowdata.subtotal::text));
 if rowdata.sales_tax_amount>0 then lines:=lines||jsonb_build_array(jsonb_build_object('account_id',public.acc_account('sales_tax'),'credit',rowdata.sales_tax_amount::text));end if;
 if rowdata.advance_tax_amount>0 then lines:=lines||jsonb_build_array(jsonb_build_object('account_id',public.acc_account('advance_tax'),'credit',rowdata.advance_tax_amount::text));end if;
 did:=public.acc_write_journal(jsonb_build_object('date',rowdata.date,'memo','Invoice '||rowdata.number,'lines',lines),'invoice',rowdata.id);
 update public.invoices set accounting_journal_id=did where id=rowdata.id;
 elsif p_action='post_bill' then
 select * into rowdata from public.supplier_bills where id=(p_data->>'id')::uuid and owner_id=uid for update;if rowdata.id is null then raise exception 'Bill not found';end if;
 if rowdata.journal_id is not null then return jsonb_build_object('id',rowdata.journal_id);end if;if rowdata.total<=0 or rowdata.subtotal<=0 then raise exception 'Positive bill subtotal required';end if;
 lines:=jsonb_build_array(jsonb_build_object('account_id',rowdata.debit_account_id,'debit',rowdata.subtotal::text),jsonb_build_object('account_id',public.acc_account('payable'),'supplier_id',rowdata.supplier_id,'credit',rowdata.total::text));
 if rowdata.tax_amount>0 then lines:=lines||jsonb_build_array(jsonb_build_object('account_id',public.acc_account('purchase_tax'),'debit',rowdata.tax_amount::text));end if;
 did:=public.acc_write_journal(jsonb_build_object('date',rowdata.date,'memo','Supplier bill '||rowdata.number,'lines',lines),'bill',rowdata.id);update public.supplier_bills set journal_id=did where id=rowdata.id;
 elsif p_action='save_journal' then
 kind:=coalesce(p_data->>'source_type','manual');if kind not in ('manual','opening') then raise exception 'Manual/opening entries only';end if;
 did:=public.acc_write_journal(p_data,kind,null,coalesce((p_data->>'post')::boolean,false),null,nullif(p_data->>'id','')::uuid,p_data->>'version');
 elsif p_action='post_journal' then
 select * into rowdata from public.journals where id=(p_data->>'id')::uuid and owner_id=uid for update;if rowdata.id is null then raise exception 'Journal not found';end if;
 if rowdata.status='posted' then return jsonb_build_object('id',rowdata.id);end if;
 if rowdata.date<=(select locked_through from public.accounting_config where owner_id=uid) then raise exception 'This accounting period is locked';end if;
 if exists(select 1 from public.journal_lines l join public.accounts a on a.id=l.account_id where l.journal_id=rowdata.id and not a.active) then raise exception 'Journal has inactive accounts';end if;
 update public.journals set status='posted',posted_at=clock_timestamp() where id=rowdata.id;did:=rowdata.id;
 elsif p_action='settle' then
 kind:=p_data->>'kind';if kind is null or kind not in ('receipt','payment') then raise exception 'Invalid settlement';end if;
 party:=(p_data->>'party_id')::uuid;cash:=(p_data->>'cash_account_id')::uuid;target:=nullif(p_data->>'target_id','')::uuid;amount:=(p_data->>'amount')::numeric;dt:=(p_data->>'date')::date;
 if amount is null or amount<=0 or amount>=1e20 or scale(amount)>20 then raise exception 'Positive amount required';end if;
 if not exists(select 1 from public.accounts where id=cash and owner_id=uid and active and is_cash) then raise exception 'Select an active cash/bank account';end if;
 aid:=public.acc_account(case when ac.kind='receipt' then 'receivable' else 'payable' end);
 select least(coalesce(sum(case when ac.kind='receipt' then l.debit-l.credit else l.credit-l.debit end),0),coalesce(sum(case when ac.kind='receipt' then l.debit-l.credit else l.credit-l.debit end) filter(where j.date<=dt),0)) into balance from public.journal_lines l join public.journals j on j.id=l.journal_id where l.owner_id=uid and l.account_id=aid and j.status='posted' and (case when ac.kind='receipt' then l.customer_id=party else l.supplier_id=party end);
 if amount>balance then raise exception 'Amount exceeds the party outstanding balance';end if;
 if target is not null then
 if kind='receipt' then select grand_total as total,accounting_journal_id as journal_id,date into rowdata from public.invoices where id=target and owner_id=uid and customer_id=party;
 else select total,journal_id,date into rowdata from public.supplier_bills where id=target and owner_id=uid and supplier_id=party;end if;
 if rowdata.journal_id is null or exists(select 1 from public.journals where reverses_id=rowdata.journal_id) then raise exception 'Choose a posted, unreversed document for this party';end if;
 if dt<rowdata.date then raise exception 'Settlement cannot predate its document';end if;
 select rowdata.total-coalesce(sum(s.amount),0) into balance from public.settlements s where s.owner_id=uid and (case when ac.kind='receipt' then s.invoice_id=target else s.bill_id=target end) and not exists(select 1 from public.journals j where j.reverses_id=s.journal_id);
 if amount>balance then raise exception 'Amount exceeds document outstanding balance';end if;
 end if;
 did:=gen_random_uuid();memo:=case when ac.kind='receipt' then 'Customer receipt' else 'Supplier payment' end;
 lines:=case when ac.kind='receipt' then jsonb_build_array(jsonb_build_object('account_id',cash,'debit',amount::text),jsonb_build_object('account_id',aid,'customer_id',party,'credit',amount::text)) else jsonb_build_array(jsonb_build_object('account_id',aid,'supplier_id',party,'debit',amount::text),jsonb_build_object('account_id',cash,'credit',amount::text)) end;
 jid:=public.acc_write_journal(jsonb_build_object('date',dt,'memo',memo||' '||coalesce(p_data->>'reference',''),'lines',lines),kind,did);
 insert into public.settlements(id,owner_id,kind,number,date,customer_id,supplier_id,invoice_id,bill_id,cash_account_id,amount,reference,notes,journal_id) values(did,uid,kind,public.acc_number(kind,case when ac.kind='receipt' then 'RCPT-' else 'PAY-' end),dt,case when ac.kind='receipt' then party end,case when ac.kind='payment' then party end,case when ac.kind='receipt' then target end,case when ac.kind='payment' then target end,cash,amount,coalesce(p_data->>'reference',''),coalesce(p_data->>'notes',''),jid);
 elsif p_action='reverse' then
 if coalesce(length(trim(p_data->>'reason')),0)=0 then raise exception 'Reversal reason required';end if;
 select * into rowdata from public.journals where id=(p_data->>'id')::uuid and owner_id=uid for update;if rowdata.id is null or rowdata.status<>'posted' or rowdata.reverses_id is not null then raise exception 'Select an original posted journal';end if;
 if exists(select 1 from public.journals where reverses_id=rowdata.id) then raise exception 'Journal already reversed';end if;
 dt:=(p_data->>'date')::date;if dt<rowdata.date then raise exception 'Reversal cannot predate original';end if;
 if exists(select 1 from public.settlements s where s.owner_id=uid and ((rowdata.source_type='invoice' and s.invoice_id=rowdata.source_id) or(rowdata.source_type='bill' and s.bill_id=rowdata.source_id)) and not exists(select 1 from public.journals j where j.reverses_id=s.journal_id)) then raise exception 'Reverse linked receipts/payments first';end if;
 select jsonb_agg(jsonb_build_object('account_id',account_id,'customer_id',customer_id,'supplier_id',supplier_id,'debit',credit::text,'credit',debit::text,'description',description) order by sort_order) into lines from public.journal_lines where journal_id=rowdata.id;
 did:=public.acc_write_journal(jsonb_build_object('date',dt,'memo','Reversal of '||rowdata.number||': '||coalesce(p_data->>'reason','Correction'),'lines',lines),'reversal',rowdata.id,true,rowdata.id);
 elsif p_action='lock_period' then
 dt:=(p_data->>'date')::date;if dt is null or not isfinite(dt) or dt>current_date then raise exception 'Valid past/current closing date required';end if;
 if dt<(select locked_through from public.accounting_config where owner_id=uid) then raise exception 'Periods cannot be reopened through the app';end if;
 update public.accounting_config set locked_through=dt where owner_id=uid;return jsonb_build_object('ok',true);
 else raise exception 'Unknown accounting action';end if;
 return jsonb_build_object('id',did);
end $$;
revoke all on function public.acc_number(text,text),public.acc_account(text),public.acc_write_journal(jsonb,text,uuid,boolean,uuid,uuid,text),public.acc_save_trade(text,jsonb) from public,anon,authenticated;
revoke all on function public.accounting_command(text,jsonb) from public,anon;
grant execute on function public.accounting_command(text,jsonb) to authenticated;
-- Read helpers run with caller privileges and RLS.
create function public.accounting_document(p_kind text,p_id uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare doc jsonb;lines jsonb;begin
 if p_kind='order' then
 select to_jsonb(d)||jsonb_build_object('total',total::text) into doc from public.trade_orders d where id=p_id;
 select coalesce(jsonb_agg(to_jsonb(l)||jsonb_build_object('quantity',quantity::text,'rate',rate::text,'amount',amount::text) order by sort_order),'[]') into lines from public.order_items l where document_id=p_id;
 elsif p_kind='bill' then
 select to_jsonb(d)||jsonb_build_object('subtotal',subtotal::text,'tax_amount',tax_amount::text,'total',total::text) into doc from public.supplier_bills d where id=p_id;
 select coalesce(jsonb_agg(to_jsonb(l)||jsonb_build_object('quantity',quantity::text,'rate',rate::text,'amount',amount::text) order by sort_order),'[]') into lines from public.bill_items l where document_id=p_id;
 elsif p_kind='journal' then
 select to_jsonb(d) into doc from public.journals d where id=p_id;
 select coalesce(jsonb_agg(to_jsonb(l)||jsonb_build_object('debit',debit::text,'credit',credit::text,'account_code',a.code,'account_name',a.name) order by sort_order),'[]') into lines from public.journal_lines l join public.accounts a on a.id=l.account_id where journal_id=p_id;
 else raise exception 'Invalid document kind';end if;
 if doc is null then raise exception 'Document not found';end if;return doc||jsonb_build_object('items',lines);
end $$;
create function public.accounting_report(p_from date,p_to date,p_account uuid default null,p_party uuid default null,p_party_kind text default null) returns jsonb language plpgsql security invoker set search_path='' as $$
declare rows jsonb;ledger jsonb;opening numeric;income numeric;cost numeric;expenses numeric;assets numeric;liabilities numeric;equity numeric;profit numeric;debits numeric;credits numeric;
begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 if p_from is null or p_to is null or p_from>p_to or not isfinite(p_from) or not isfinite(p_to) then raise exception 'Valid date range required';end if;
 if p_party is not null and (p_party_kind is null or p_party_kind not in ('customer','supplier')) then raise exception 'Party kind required';end if;
 if p_account is not null and not exists(select 1 from public.accounts where id=p_account) then raise exception 'Account not found';end if;
 with sums as(
 select a.id,a.code,a.name,a.category,a.system_key,
 coalesce(sum(l.debit-l.credit) filter(where j.date<p_from),0) as opening,
 coalesce(sum(l.debit) filter(where j.date>=p_from),0) as debit,
 coalesce(sum(l.credit) filter(where j.date>=p_from),0) as credit,
 coalesce(sum(l.debit-l.credit),0) as closing
 from public.accounts a left join (public.journal_lines l join public.journals j on j.id=l.journal_id and j.status='posted' and j.date<=p_to) on l.account_id=a.id group by a.id
 ) select coalesce(jsonb_agg(jsonb_build_object('id',id,'code',code,'name',name,'category',category,'system_key',system_key,'opening',sums.opening::text,'debit',debit::text,'credit',credit::text,'closing',closing::text) order by code),'[]'),
 coalesce(sum(credit-debit) filter(where category='income'),0),coalesce(sum(debit-credit) filter(where system_key='cogs'),0),coalesce(sum(debit-credit) filter(where category='expense' and system_key is distinct from 'cogs'),0),
 coalesce(sum(closing) filter(where category='asset'),0),coalesce(sum(-closing) filter(where category='liability'),0),coalesce(sum(-closing) filter(where category='equity'),0),coalesce(sum(-closing) filter(where category in ('income','expense')),0),coalesce(sum(greatest(closing,0)),0),coalesce(sum(greatest(-closing,0)),0)
 into rows,income,cost,expenses,assets,liabilities,equity,profit,debits,credits from sums;
 select coalesce(sum(l.debit-l.credit),0) into opening from public.journal_lines l join public.journals j on j.id=l.journal_id where j.status='posted' and j.date<p_from and (p_account is null or l.account_id=p_account) and (p_party is null or (p_party_kind='customer' and l.customer_id=p_party) or(p_party_kind='supplier' and l.supplier_id=p_party));
 with movements as(
 select l.id,l.account_id,l.customer_id,l.supplier_id,l.debit,l.credit,l.description,j.id journal_id,j.number,j.date,j.memo,j.source_type,a.name account_name,a.code account_code,
 row_number() over(order by j.date,j.created_at,j.id,l.sort_order,l.id) as sequence,
 sum(l.debit-l.credit) over(order by j.date,j.created_at,j.id,l.sort_order,l.id) as running
 from public.journal_lines l join public.journals j on j.id=l.journal_id join public.accounts a on a.id=l.account_id where j.status='posted' and j.date<=p_to and (p_account is null or l.account_id=p_account) and(p_party is null or(p_party_kind='customer' and l.customer_id=p_party) or(p_party_kind='supplier' and l.supplier_id=p_party))
 )select coalesce(jsonb_agg(to_jsonb(m)||jsonb_build_object('debit',debit::text,'credit',credit::text,'running',running::text) order by sequence),'[]') into ledger from movements m where date>=p_from;
 return jsonb_build_object('accounts',rows,'ledger',ledger,'opening',opening::text,'income',income::text,'cost_of_sales',cost::text,'operating_expenses',expenses::text,'gross_profit',(income-cost)::text,'net_profit',(income-cost-expenses)::text,'assets',assets::text,'liabilities',liabilities::text,'equity',equity::text,'accumulated_profit',profit::text,'total_equity',(equity+profit)::text,'balance_difference',(assets-liabilities-equity-profit)::text,'trial_debits',debits::text,'trial_credits',credits::text);
end $$;
revoke all on function public.accounting_document(text,uuid),public.accounting_report(date,date,uuid,uuid,text) from public,anon;
grant execute on function public.accounting_document(text,uuid),public.accounting_report(date,date,uuid,uuid,text) to authenticated;

commit;
