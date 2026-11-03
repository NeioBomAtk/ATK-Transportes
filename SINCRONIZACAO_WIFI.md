# Sincronização do app ATK por Wi-Fi

O app do PC é a fonte dos dados administrativos. Ele publica o estado salvo no serviço local, e o celular busca uma cópia quando você toca em **Receber dados do PC**. A conexão da aba **Contabilidade ATK** continua independente e segue recebendo a telemetria do ETS2.

## Primeira configuração

1. Conecte o PC e o Moto G22 à mesma rede Wi-Fi.
2. No PC, abra o app com `run_app.ps1`. Esse script inicia o serviço local de sincronização junto com o app.
3. No app do PC, abra **Sincronizar**. A tela mostra um ou mais endereços de rede e um código de conexão.
4. No Moto G22, abra **Sincronizar**, informe o endereço e o código mostrados no PC e toque em **Receber dados do PC**.
5. Se o Windows perguntar, permita o acesso do Node.js à rede privada. O endereço e o código ficam salvos no celular para as próximas sincronizações.

Escolha no celular o endereço que pertence à mesma rede Wi-Fi. Por exemplo, se o PC mostrar `http://192.168.1.50:25556`, informe esse endereço completo.

## Uso diário

O PC publica os dados automaticamente após cada salvamento. Para atualizar o celular, abra **Sincronizar** no app do celular e toque em **Receber dados do PC**. Se o celular já tiver dados salvos, o app pede confirmação e guarda uma cópia anterior antes de substituir o estado local.

O PC precisa estar ligado, com o app aberto pelo `run_app.ps1`, durante a transferência. A sincronização funciona na rede local, sem WhatsApp ou acesso à internet. O botão de sincronização por código continua disponível como alternativa.

## Segurança e conexão

O código de conexão é aleatório e fica salvo no arquivo local `.atk-sync-token`, ignorado pelo Git. Ele autoriza o acesso aos dados do app na rede local. Não compartilhe esse código com outras pessoas. O serviço usa a porta TCP `25556`; se a rede bloquear o acesso, permita o Node.js na rede privada do Windows e confirme que os dois aparelhos estão no mesmo Wi-Fi.
