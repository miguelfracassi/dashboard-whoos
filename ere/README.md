# Painel Glass (Vercel + Supabase)
1. Supabase → SQL Editor:
   create table painel(id int primary key, data jsonb not null);
   insert into painel values (1, '{"products":[],"tickets":[],"sales":[]}');
2. Vercel → Settings → Environment Variables:
   GROQ_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY, API_KEY (a key do seu bot, invente uma longa)
3. Faça o deploy da pasta (a raiz do projeto é esta pasta). Faça Redeploy depois de criar as variáveis.
Páginas: / · /gerenciar/products · /gerenciar/tickets · /vendas · /developers/api
