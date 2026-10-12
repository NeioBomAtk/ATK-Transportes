# ATK Transportes - Gestão Logística para ETS2 🚛

Este é um aplicativo web voltado para mobile (via Cordova) projetado especialmente para criar uma camada de gestão e simulação econômica hiper-realista por cima do seu progresso no jogo **Euro Truck Simulator 2**.

## 📌 Funcionalidades Principais

* 📊 **Dashboard Financeiro Completo:** Sincronize seu dinheiro do jogo com o aplicativo.
* 📈 **Sistema de Gangorra (Lucros e Despesas):** Ajuste facilmente o seu desempenho semanal (Lucro/Despesa) sem afetar o seu *Saldo Atual* da vida real no jogo. 
* 🚚 **Gerenciamento de Frota:** Controle total sobre os seus caminhões e reboques.
* 🏭 **Imobiliária de Garagens:** Compre e expanda garagens em diferentes cidades do seu mapa de exploração.
* 👥 **Gestão de Equipe (RH):** Contrate, demita, defina diárias, transfira funcionários entre garagens e calcule automaticamente o lucro contábil da sua equipe.
* 🗺️ **Mapa Interativo (EAA):** Sistema customizado para visualizar marcações de rotas com zoom dinâmico na tela.
* 🏦 **Sistema Bancário:** Simulação completa de empréstimos e amortizações, caso o banco do ETS2 não seja suficiente.
* 💾 **Exportação de Save Segura:** Você não perde seu progresso. O estado atual pode ser exportado a qualquer momento.

## 🛠️ Tecnologias Utilizadas
* **HTML5, CSS3, e Vanilla JavaScript** (Sem bibliotecas complexas dependentes)
* **Design Responsivo e Mobile-first** (UI elaborada especialmente para ser emulada ou instalada via Apache Cordova)
* FontAwesome Icons & Toastify (para notificações)

## 💡 Como Usar (Workflow do Jogo)
A ideia de uso do aplicativo é atuar como seu painel de bordo e gestão enquanto roda pela Europa ou Brasil (Mapa EAA). 
* Quando sofrer um dano, bata na mesma tecla em "Registrar Gasto".
* Quando concluir o frete, adicione todo o valor no seu Saldo da ATK Transportes.
* Sincronize suas compras (caminhões e reboques) para manter suas vagas de garagem batendo perfeitamente com a realidade.
* Você consegue adicionar despesas e corrigir o "score semanal" do seu motorista utilizando os botões de ajuste inteligente do app!

---

## 📡 Como Sincronizar a Telemetria com o ETS2 (Ao Vivo)

Para que a aba **Contabilidade ATK** funcione em tempo real com o jogo, exibindo velocidade, combustível, danos do caminhão/reboque, tempo de descanso, carga e valor do frete, é necessário conectar o aplicativo ao servidor de telemetria local.

### 1. Qual Telemetria Utilizar? ⚠️
O aplicativo foi desenvolvido e homologado especificamente para a telemetria **Funbit ETS2 Telemetry Server**. **Não utilize outras telemetrias ou plugins genéricos**, pois o formato dos dados da API não será compatível e a sincronização não funcionará.

* **Servidor incluso no projeto:** Já disponibilizamos uma pasta pronta para uso no próprio repositório: `Servidor_Telemetria_ATK/`.
* **Link Oficial / Download do Servidor:**  
  [Funbit ETS2 Telemetry Server no GitHub](https://github.com/Funbit/ets2-telemetry-server)  
  *Página de Releases para download:* [https://github.com/Funbit/ets2-telemetry-server/releases](https://github.com/Funbit/ets2-telemetry-server/releases)

### 2. Passo a Passo para Instalação e Execução:
1. Abra a pasta `Servidor_Telemetria_ATK` (ou a pasta onde você extraiu o servidor baixado).
2. Execute o arquivo **`Ets2Telemetry.exe`** como **Administrador** na primeira vez para permitir que ele instale o plugin DLL automaticamente dentro da pasta do jogo (`bin\win_x64\plugins`).
3. O servidor abrirá uma janela indicando que está rodando na porta padrão **25555**.

### 3. Como Descobrir o seu Endereço IP Local:
Para conectar seu celular, tablet ou o próprio navegador ao jogo:
* O dispositivo onde o aplicativo ATK está aberto e o computador onde o Euro Truck Simulator 2 está rodando **precisam estar conectados na mesma rede (mesmo Wi-Fi ou rede cabeada)**.
* Para saber o IP do seu PC:
  * O próprio executável do `Ets2Telemetry.exe` exibe na tela os endereços de rede disponíveis (exemplo: `192.168.1.100` ou similar).
  * Ou abra o **Prompt de Comando (CMD)** no Windows, digite `ipconfig` e aperte Enter. Localize o campo **Endereço IPv4** (ex: `192.168.1.X`).

### 4. Sincronizando no Aplicativo ATK Transportes:
1. Abra o aplicativo **ATK Transportes**.
2. Clique no menu **Contabilidade ATK** (ícone de antena/radar).
3. No campo de texto **"Endereço IP do Servidor de Telemetria (LocalBase)"**, informe a URL com o seu IP no formato:
   ```text
   http://SEU_IP:25555/api/ets2/telemetry
   ```
   *(Substitua `SEU_IP` pelo endereço IP do seu computador obtido no passo anterior, por exemplo: `http://192.168.1.50:25555/api/ets2/telemetry`)*.
4. Clique no botão **Conectar Radar**.
5. O status passará de `DESCONECTADO` para **`ON-LINE (AO VIVO)`** com fundo verde, passando a sincronizar todos os dados do caminhão automaticamente a cada segundo!

---

## 🚚 Mod de Motoristas Customizado da ATK

O repositório inclui o mod com avatares e nomes personalizados dos motoristas da ATK para o ETS2 na pasta `mod_ets2/mod-motoristas-atk.scs`.

* **Como instalar:**
  1. Copie o arquivo `mod_ets2/mod-motoristas-atk.scs` para a pasta de mods do Euro Truck Simulator 2 (geralmente localizada em: `Documentos\Euro Truck Simulator 2\mod`).
  2. No menu principal do jogo, acerte o **Gerenciador de Mods**, ative o mod da ATK e confirme as alterações.
  3. Ao contratar motoristas nas agências de recrutamento do jogo, você verá a equipe personalizada da ATK pronta para trabalhar!

---

## 🔐 Licença
Projeto particular e mantido sob versão segura no repositório.

---
*"Boa viagem, motorista! Mantenha a borracha no asfalto e as rodas virando!"*

