# Painel Glass (Vercel + Supabase)
1. Supabase → SQL Editor:
   create table painel(id int primary key, data jsonb not null);
   insert into painel values (1, '{"products":[],"tickets":[],"sales":[]}');
2. Vercel → Settings → Environment Variables:
   GROQ_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY, API_KEY (a key do seu bot, invente uma longa)
3. Faça o deploy da pasta (a raiz do projeto é esta pasta). Faça Redeploy depois de criar as variáveis.
Páginas: / · /gerenciar/products · /gerenciar/tickets · /vendas · /developers/api

Novidades: categorias de produtos (crie em /gerenciar/products) e estoque infinito (marque "Estoque infinito" no produto). Nao precisa alterar o banco.
Se a IA der erro de modelo, crie GROQ_MODEL na Vercel (ex.: openai/gpt-oss-120b, sem ponto no final).

Cupons: cadastre em /gerenciar/coupons. O bot chama POST /api/quote (resumo com desconto) e depois POST /api/tickets com productId e coupon.

Embeds: crie DISCORD_TOKEN (token do bot) e, opcionalmente, DISCORD_GUILD_ID na Vercel. O bot precisa de Ver canal e Enviar mensagens nos canais. Pagina: /gerenciar/embeds
