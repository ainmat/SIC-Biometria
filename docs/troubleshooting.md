# 🔧 Guia Rápido - Solução de Problemas

## Problema: Página mostrando "Carregando..." ou valores zerados

### Causa Mais Comum: Credenciais do Supabase não configuradas

#### ✅ Solução 1: Configurar o arquivo .env

1. **Verifique se o arquivo `.env` existe:**
   ```bash
   ls -la .env
   ```

2. **Se não existir, crie-o:**
   ```bash
   cp .env.example .env
   ```

3. **Edite o arquivo `.env` com suas credenciais reais:**
   ```env
   VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
   VITE_SUPABASE_ANON_KEY=SUA-CHAVE-ANONIMA-AQUI
   ```

4. **Onde encontrar as credenciais:**
   - Acesse [app.supabase.com](https://app.supabase.com)
   - Selecione seu projeto
   - Vá em Settings → API
   - Copie a URL e a anon key

#### ✅ Solução 2: Testar com página simplificada

1. **Abra o arquivo de teste:**
   ```
   test-equipamentos.html
   ```

2. **Abra no navegador:**
   - Dê duplo clique no arquivo
   - Ou use: `open test-equipamentos.html`

3. **Verifique o console (F12) para mensagens de erro**

#### ✅ Solução 3: Verificar se a tabela existe

1. **Acesse o Supabase Dashboard**
2. **Vá para Table Editor**
3. **Verifique se a tabela `equipamentos` existe**
4. **Se não existir, execute o script SQL:**
   ```sql
   -- Use o arquivo create_equipamentos_table.sql
   ```

#### ✅ Solução 4: Verificar permissões (RLS)

1. **No Supabase Dashboard, vá para Authentication → Policies**
2. **Verifique se existem políticas para a tabela `equipamentos`**
3. **Se necessário, desabilite RLS temporariamente para teste:**
   ```sql
   ALTER TABLE equipamentos DISABLE ROW LEVEL SECURITY;
   ```

### 🔍 Debug Passo a Passo

1. **Verifique o console do navegador (F12)**
2. **Procure por erros como:**
   - "Credenciais do Supabase não configuradas"
   - "Table 'equipamentos' doesn't exist"
   - "Permission denied"

3. **Teste a API diretamente:**
   ```javascript
   // No console do navegador
   fetch('https://SEU-PROJETO.supabase.co/rest/v1/equipamentos', {
     headers: {
       'apikey': 'SUA-CHAVE-ANONIMA',
       'Content-Type': 'application/json'
     }
   })
   .then(res => res.json())
   .then(data => console.log(data))
   .catch(err => console.error(err));
   ```

### 🚀 Teste Final

1. **Após configurar as credenciais:**
   ```bash
   npm run dev
   ```

2. **Acesse:**
   ```
   http://localhost:5173/parque-equipamentos.html
   ```

3. **Deve aparecer:**
   - ✅ Dados reais do banco
   - ✅ Estatísticas corretas
   - ✅ Botão de atualizar funcionando

### 📞 Se ainda não funcionar

1. **Verifique o arquivo `.env` está na pasta raiz**
2. **Reinicie o servidor de desenvolvimento**
3. **Limpe o cache do navegador (Ctrl+F5)**
4. **Verifique no console se as variáveis de ambiente foram carregadas:**
   ```javascript
   console.log(import.meta.env.VITE_SUPABASE_URL);
   ```

---

## 🎯 Checklist Final

- [ ] Arquivo `.env` configurado
- [ ] Credenciais corretas do Supabase
- [ ] Tabela `equipamentos` existe
- [ ] Permissões (RLS) configuradas
- [ ] Dados existem na tabela
- [ ] Servidor de desenvolvimento rodando
- [ ] Console sem erros

Se tudo estiver marcado, a página deve funcionar perfeitamente! 🎉
