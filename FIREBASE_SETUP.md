# 🔥 Configuração do Firebase - VoteCerto

Guia completo para configurar o Firebase para o sistema VoteCerto.

## 📋 Pré-requisitos

1. Conta Google ativa
2. Acesso ao [Firebase Console](https://console.firebase.google.com/)

## 🚀 Passo a Passo

### 1. Criar Projeto Firebase

1. Acesse o [Firebase Console](https://console.firebase.google.com/)
2. Clique em "Criar um projeto"
3. Nome do projeto: `votecerto` (ou nome de sua escolha)
4. Desabilite o Google Analytics (opcional)
5. Clique em "Criar projeto"

### 2. Configurar Authentication

1. No painel lateral, clique em "Authentication"
2. Vá para a aba "Sign-in method"
3. Ative o provedor "Email/senha"
4. Clique em "Salvar"

### 3. Configurar Realtime Database

1. No painel lateral, clique em "Realtime Database"
2. Clique em "Criar banco de dados"
3. Escolha a localização: `us-central1` (ou mais próxima)
4. Inicie em "Modo de teste" (configuraremos as regras depois)

### 4. Configurar Regras de Segurança

Substitua as regras padrão pelas seguintes:

```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read": "auth != null && (auth.uid == $uid || root.child('users').child(auth.uid).child('role').val() == 'admin' || root.child('users').child(auth.uid).child('role').val() == 'commission')",
        ".write": "auth != null && (auth.uid == $uid || root.child('users').child(auth.uid).child('role').val() == 'admin')"
      }
    },
    "elections": {
      ".read": "auth != null",
      ".write": "auth != null && (root.child('users').child(auth.uid).child('role').val() == 'admin' || root.child('users').child(auth.uid).child('role').val() == 'commission')",
      "$electionId": {
        ".validate": "newData.hasChildren(['title', 'description', 'type', 'status', 'startDate', 'endDate', 'createdAt', 'createdBy'])"
      }
    },
    "candidates": {
      ".read": "auth != null",
      ".write": "auth != null && (root.child('users').child(auth.uid).child('role').val() == 'admin' || root.child('users').child(auth.uid).child('role').val() == 'commission')",
      "$candidateId": {
        ".validate": "newData.hasChildren(['name', 'number', 'electionId', 'createdAt'])"
      }
    },
    "votes": {
      ".read": "auth != null && (root.child('users').child(auth.uid).child('role').val() == 'admin' || root.child('users').child(auth.uid).child('role').val() == 'commission')",
      ".write": "auth != null && root.child('users').child(auth.uid).child('role').val() == 'voter'",
      "$voteId": {
        ".validate": "newData.hasChildren(['userId', 'candidateId', 'electionId', 'hash', 'timestamp']) && newData.child('userId').val() == auth.uid"
      }
    },
    "activities": {
      ".read": "auth != null && (root.child('users').child(auth.uid).child('role').val() == 'admin' || root.child('users').child(auth.uid).child('role').val() == 'commission')",
      ".write": "auth != null"
    }
  }
}
```

### 5. Obter Credenciais

1. Clique no ícone de engrenagem ⚙️ > "Configurações do projeto"
2. Vá para a aba "Geral"
3. Role até "Seus aplicativos"
4. Clique em "</> Web"
5. Nome do app: `VoteCerto`
6. **NÃO** marque "Configurar Firebase Hosting"
7. Clique em "Registrar app"
8. Copie as credenciais mostradas

### 6. Configurar Credenciais no Projeto

Abra o arquivo `js/firebase-config.js` e substitua as credenciais:

```javascript
// Substitua estas credenciais pelas suas
const firebaseConfig = {
  apiKey: "SUA_API_KEY_AQUI",
  authDomain: "seu-projeto.firebaseapp.com",
  databaseURL: "https://seu-projeto-default-rtdb.firebaseio.com/",
  projectId: "seu-projeto",
  storageBucket: "seu-projeto.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456"
};
```

## 👤 Criar Usuário Administrador

### Método 1: Via Interface (Recomendado)

1. Abra o projeto no navegador
2. Vá para a página de login
3. Use os botões de "Login Rápido" para criar usuários demo
4. O sistema criará automaticamente:
   - Admin: `admin@votecerto.com` / `admin123`
   - Comissão: `comissao@votecerto.com` / `comissao123`
   - Eleitor: `eleitor@votecerto.com` / `eleitor123`

### Método 2: Via Firebase Console

1. Vá para "Authentication" > "Users"
2. Clique em "Adicionar usuário"
3. Email: `admin@votecerto.com`
4. Senha: `admin123` (ou senha de sua escolha)
5. Clique em "Adicionar usuário"
6. Copie o UID do usuário criado
7. Vá para "Realtime Database"
8. Adicione manualmente:

```json
{
  "users": {
    "UID_DO_USUARIO_AQUI": {
      "name": "Administrador",
      "email": "admin@votecerto.com",
      "role": "admin",
      "createdAt": 1640995200000
    }
  }
}
```

## 🔒 Configurações de Segurança Avançadas

### Domínios Autorizados

1. Vá para "Authentication" > "Settings"
2. Na seção "Authorized domains", adicione:
   - `localhost` (para desenvolvimento)
   - Seu domínio do Vercel (ex: `votecerto.vercel.app`)
   - Domínio personalizado (se houver)

### Configurações de Email

1. Vá para "Authentication" > "Templates"
2. Configure os templates de email:
   - **Verificação de email**: Personalize conforme necessário
   - **Redefinição de senha**: Personalize conforme necessário
3. Configure o remetente:
   - Nome: `VoteCerto`
   - Email: Use um email verificado

## 📊 Estrutura de Dados Inicial

Após a configuração, sua estrutura de dados deve ficar assim:

```json
{
  "users": {
    "uid1": {
      "name": "Administrador",
      "email": "admin@votecerto.com",
      "role": "admin",
      "createdAt": 1640995200000
    }
  },
  "elections": {},
  "candidates": {},
  "votes": {},
  "activities": {}
}
```

## 🧪 Testar Configuração

1. Abra o projeto no navegador
2. Vá para a página de login
3. Teste o login com as credenciais criadas
4. Verifique se o redirecionamento funciona corretamente
5. Teste a criação de uma eleição (se admin)

## ⚠️ Problemas Comuns

### Erro de CORS
- **Causa**: Domínio não autorizado
- **Solução**: Adicione o domínio em "Authorized domains"

### Erro de Permissão
- **Causa**: Regras de segurança muito restritivas
- **Solução**: Verifique as regras no Realtime Database

### Usuário não consegue fazer login
- **Causa**: Usuário não existe no Authentication
- **Solução**: Crie o usuário via Console ou interface

### Dados não aparecem
- **Causa**: Estrutura de dados incorreta
- **Solução**: Verifique a estrutura no Realtime Database

## 📈 Monitoramento

### Analytics (Opcional)

1. Vá para "Analytics"
2. Configure eventos personalizados:
   - `vote_cast`: Quando um voto é registrado
   - `election_created`: Quando uma eleição é criada
   - `user_login`: Quando um usuário faz login

### Performance Monitoring

1. Vá para "Performance"
2. Ative o monitoramento
3. Configure alertas para:
   - Tempo de carregamento > 3s
   - Taxa de erro > 1%

## 🔄 Backup e Recuperação

### Backup Manual

1. Vá para "Realtime Database"
2. Clique nos três pontos ⋮
3. Selecione "Exportar JSON"
4. Salve o arquivo em local seguro

### Backup Automático

1. Configure backups automáticos via Firebase CLI
2. Use Cloud Functions para backups periódicos

## 🚀 Próximos Passos

Após configurar o Firebase:

1. ✅ Teste todas as funcionalidades
2. ✅ Configure o deploy no Vercel
3. ✅ Adicione domínio personalizado (opcional)
4. ✅ Configure monitoramento
5. ✅ Treine usuários administradores

---

**Importante**: Mantenha suas credenciais Firebase seguras e nunca as compartilhe publicamente!