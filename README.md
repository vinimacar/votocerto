# 🗳️ VoteCerto - Sistema de Eleição Online

Sistema completo de eleições online para escolas, condomínios, CIPA, grêmios e associações. Interface futurista, segura e responsiva.

## 🚀 Características

- **Interface Futurista**: Design dark mode com efeitos neon
- **Totalmente Responsivo**: Funciona em desktop, tablet e mobile
- **Seguro**: Autenticação Firebase e criptografia de votos
- **Tempo Real**: Apuração e resultados em tempo real
- **Relatórios Completos**: Exportação em PDF, Excel, CSV e JSON

## 🛠️ Tecnologias

- **Frontend**: HTML5, CSS3, Bootstrap 5, JavaScript ES6+
- **Backend**: Firebase (Authentication + Realtime Database)
- **Hospedagem**: Vercel
- **Gráficos**: Chart.js
- **Ícones**: Font Awesome

## 📁 Estrutura do Projeto

```
votecerto/
├── public/                 # Páginas HTML
│   ├── index.html         # Página inicial
│   ├── login.html         # Autenticação
│   ├── urna.html          # Interface de votação
│   ├── dashboard.html     # Painel administrativo
│   ├── resultados.html    # Resultados em tempo real
│   └── relatorios.html    # Relatórios e exportação
├── css/
│   └── style.css          # Estilos futuristas
├── js/                    # Scripts JavaScript
│   ├── firebase-config.js # Configuração Firebase
│   ├── auth.js           # Sistema de autenticação
│   ├── admin.js          # Painel administrativo
│   ├── urna.js           # Sistema de votação
│   ├── resultados.js     # Apuração em tempo real
│   └── relatorios.js     # Geração de relatórios
├── assets/               # Recursos estáticos
│   ├── logos/           # Logos do sistema
│   └── candidatos/      # Fotos dos candidatos
├── vercel.json          # Configuração de deploy
└── README.md            # Documentação
```

## 👥 Tipos de Usuário

### 🔧 Administrador
- Criar e gerenciar eleições
- Cadastrar candidatos e eleitores
- Configurar períodos de votação
- Acessar todos os relatórios

### 📊 Comissão Eleitoral
- Monitorar eleições em andamento
- Gerar relatórios de participação
- Acompanhar apuração em tempo real

### 🗳️ Eleitor
- Votar nas eleições ativas
- Visualizar resultados públicos
- Acessar comprovante de votação

## 🎯 Funcionalidades

### ✅ Gestão de Eleições
- Criação de eleições por tipo (CIPA, escolar, condomínio, etc.)
- Configuração de datas e horários
- Status automático (rascunho, aberta, em andamento, fechada)
- Suporte a múltiplas eleições simultâneas

### 👤 Gestão de Candidatos
- Cadastro com foto, nome, número e descrição
- Validação de números únicos
- Upload de fotos otimizado

### 🗳️ Sistema de Votação
- Interface intuitiva e acessível
- Voto único por eleitor
- Criptografia e hash de segurança
- Confirmação visual do voto

### 📈 Apuração em Tempo Real
- Contagem automática de votos
- Gráficos interativos (barras e pizza)
- Atualização em tempo real
- Ranking de candidatos

### 📋 Relatórios Avançados
- Relatório geral da eleição
- Relatório de participação (quem votou/não votou)
- Relatório detalhado por candidato
- Exportação em múltiplos formatos

## 🔒 Segurança

- **Autenticação**: Firebase Authentication
- **Autorização**: Controle de acesso por perfil
- **Criptografia**: Votos hasheados com SHA-256
- **Auditoria**: Log completo de atividades
- **Validação**: Voto único por eleitor

## 🚀 Deploy no Vercel

### Pré-requisitos
1. Conta no [Firebase](https://firebase.google.com/)
2. Conta no [Vercel](https://vercel.com/)
3. Git instalado

### Configuração do Firebase

1. Crie um novo projeto no Firebase Console
2. Ative Authentication (Email/Password)
3. Ative Realtime Database
4. Configure as regras de segurança:

```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read": "auth != null && (auth.uid == $uid || root.child('users').child(auth.uid).child('role').val() == 'admin')",
        ".write": "auth != null && (auth.uid == $uid || root.child('users').child(auth.uid).child('role').val() == 'admin')"
      }
    },
    "elections": {
      ".read": "auth != null",
      ".write": "auth != null && root.child('users').child(auth.uid).child('role').val() == 'admin'"
    },
    "candidates": {
      ".read": "auth != null",
      ".write": "auth != null && root.child('users').child(auth.uid).child('role').val() == 'admin'"
    },
    "votes": {
      ".read": "auth != null && root.child('users').child(auth.uid).child('role').val() == 'admin'",
      ".write": "auth != null && root.child('users').child(auth.uid).child('role').val() == 'voter'"
    }
  }
}
```

5. Copie as credenciais do Firebase
6. Atualize o arquivo `js/firebase-config.js` com suas credenciais

### Deploy

1. **Via Vercel CLI:**
```bash
npm i -g vercel
vercel
```

2. **Via GitHub:**
- Faça push do código para um repositório GitHub
- Conecte o repositório no Vercel Dashboard
- Deploy automático será configurado

3. **Via Vercel Dashboard:**
- Faça upload do projeto diretamente
- Configure as variáveis de ambiente se necessário

## 🎨 Personalização

### Cores e Tema
Edite as variáveis CSS em `css/style.css`:

```css
:root {
  --primary-color: #00f5ff;     /* Cor principal neon */
  --secondary-color: #ff006e;   /* Cor secundária */
  --background-dark: #0a0a0a;   /* Fundo escuro */
  --surface-dark: #1a1a1a;      /* Superfície escura */
}
```

### Logos
- Substitua os arquivos na pasta `assets/logos/`
- Mantenha os mesmos nomes de arquivo
- Use formato SVG para melhor qualidade

## 📱 Responsividade

O sistema é totalmente responsivo e funciona em:
- 📱 **Mobile**: 320px - 768px
- 📱 **Tablet**: 768px - 1024px
- 🖥️ **Desktop**: 1024px+

## 🔧 Desenvolvimento

### Estrutura de Dados Firebase

```
firebase-project/
├── users/
│   └── {userId}/
│       ├── name: string
│       ├── email: string
│       ├── role: 'admin'|'commission'|'voter'
│       └── createdAt: timestamp
├── elections/
│   └── {electionId}/
│       ├── title: string
│       ├── description: string
│       ├── type: string
│       ├── status: string
│       ├── startDate: timestamp
│       └── endDate: timestamp
├── candidates/
│   └── {candidateId}/
│       ├── name: string
│       ├── number: string
│       ├── description: string
│       ├── photoUrl: string
│       └── electionId: string
└── votes/
    └── {voteId}/
        ├── userId: string
        ├── candidateId: string
        ├── electionId: string
        ├── hash: string
        └── timestamp: timestamp
```

### Scripts Disponíveis

- **Desenvolvimento Local**: Abra `public/index.html` em um servidor local
- **Build**: Não necessário (projeto estático)
- **Deploy**: `vercel` ou push para GitHub

## 📞 Suporte

Para dúvidas ou problemas:
1. Verifique a documentação
2. Consulte os logs do Firebase Console
3. Verifique o console do navegador para erros JavaScript

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo LICENSE para mais detalhes.

## 🤝 Contribuição

Contribuições são bem-vindas! Por favor:
1. Faça um fork do projeto
2. Crie uma branch para sua feature
3. Commit suas mudanças
4. Push para a branch
5. Abra um Pull Request

---

**VoteCerto** - Democratizando eleições com tecnologia! 🗳️✨