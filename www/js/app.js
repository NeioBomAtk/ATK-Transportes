// ATK Transportes - Lógica Principal do App

// Estado inicial (ou carregado do LocalStorage)
let appState = {
    saldo: 2000,
    dividaBancaria: 0,
    lucroSemanal: 0,
    despesasSemanal: 0,
    frota: 0,
    transacoes: [],
    funcionarios: [
        { id: 1, nome: 'Pokemon Atk', cargo: 'Proprietário / Motorista Principal', salario: 0 }
    ],
    caminhoes: [],
    garagens: [
        { id: 1, cidade: 'Cidade Sede', tipo: 'Pequena (1 Vaga)', capacidade: 1 }
    ],
    reboques: [],
    mapMarkers: [],
    inventarioAnual: []
};

// Carregar dados salvos (se existirem)
function loadState() {
    const saved = localStorage.getItem('atk_state');
    if (saved) {
        appState = JSON.parse(saved);
        // Garantir retrocompatibilidade caso dívida não exista no save antigo
        if (appState.dividaBancaria === undefined) appState.dividaBancaria = 0;
        if (appState.reboques === undefined) appState.reboques = [];
        if (appState.mapMarkers === undefined) appState.mapMarkers = [];
        if (appState.inventarioAnual === undefined) {
            appState.inventarioAnual = [];
        }
        
        // Remover a massa de testes fake caso esteja no armazenamento
        if (appState.inventarioAnual.length > 0 && appState.inventarioAnual[0].mes.includes("Julho/2026")) {
            appState.inventarioAnual = [];
            saveState(); // Limpa as sujeitas de teste
        }

        // Migração automática para corrigir o nome do proprietário sem precisar recomeçar
        if (appState.funcionarios && appState.funcionarios.length > 0) {
            // Verifica o Motorista 1 e altera
            if (appState.funcionarios[0].nome === 'pokemonATk' || appState.funcionarios[0].nome === 'pokemonatk') {
                appState.funcionarios[0].nome = 'Pokemon Atk';
                saveState();
            }
        }

        // Migração para corrigir o problema de semanas que não iniciaram na primeira semana do mês
        if (appState.inventarioAnual && appState.inventarioAnual.length > 0) {
            let aug = appState.inventarioAnual.find(m => m.mes.toLowerCase() === "agosto de 2026");
            if (aug && aug.semanas) {
                let changed = false;
                aug.semanas.forEach(s => {
                    // O app foi iniciado na 2ª vez nesta campanha (1ª semana do app = 2ª do calendário)
                    if (s.nome === "1ª Semana" && s._migrated !== true) {
                        s.nome = "2ª Semana";
                        s._migrated = true;
                        changed = true;
                    } else if (s.nome === "2ª Semana" && s._migrated !== true) {
                        s.nome = "3ª Semana"; 
                        s._migrated = true;
                        changed = true;
                    } else if (s.nome === "3ª Semana" && s._migrated !== true) { // Caso o user chegue aqui com 3
                        s.nome = "4ª Semana";
                        s._migrated = true;
                        changed = true;
                    }
                });
                if(changed) saveState();
            }
        }
        
        if (appState.ultimoFechamento === undefined) appState.ultimoFechamento = "";
    } else if (typeof atkPreSave !== 'undefined' && atkPreSave !== null) {
        appState = JSON.parse(JSON.stringify(atkPreSave));
    }
    updateDashboard();
    renderMapMarkers();

    // Verificação de Fechamento Automático (No Domingo = 0)
    const today = new Date();
    const todayStr = today.toLocaleDateString('pt-BR');
    
    if (today.getDay() === 0 && appState.ultimoFechamento !== todayStr) {
        appState.ultimoFechamento = todayStr;
        saveState(); // Salva estado imediatamente para evitar loop se a página recarregar no meio
        fecharSemanaAuto();
    }
    
    // Restaurar URL de telemetria se existir
    const savedUrl = localStorage.getItem('atk_telemetry_url');
    if (savedUrl) {
        const inputUrl = document.getElementById('telemetry-url');
        if(inputUrl) inputUrl.value = savedUrl;
    }

    // Migração de frota: atribui cidade explícita para caminhões e reboques de saves antigos
    if (appState.caminhoes && appState.caminhoes.length > 0 && !appState.caminhoes[0].cidade) {
        let alocIdx = 0;
        appState.garagens.forEach(g => {
            for(let i=0; i<g.capacidade; i++) {
                if (alocIdx < appState.caminhoes.length) appState.caminhoes[alocIdx++].cidade = g.cidade;
            }
        });
        while(alocIdx < appState.caminhoes.length) appState.caminhoes[alocIdx++].cidade = appState.garagens[0].cidade; 
        saveState();
    }
    if (appState.reboques && appState.reboques.length > 0 && !appState.reboques[0].cidade) {
        let alocIdx = 0;
        appState.garagens.forEach(g => {
            for(let i=0; i<g.capacidade; i++) {
                if (alocIdx < appState.reboques.length) appState.reboques[alocIdx++].cidade = g.cidade;
            }
        });
        while(alocIdx < appState.reboques.length) appState.reboques[alocIdx++].cidade = appState.garagens[0].cidade; 
        saveState();
    }
}

function saveState() {
    localStorage.setItem('atk_state', JSON.stringify(appState));
}

// Atualizar interface
function updateDashboard() {
    // Formatar moeda BRL
    const formatBRL = (value) => {
        return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    document.querySelector('.summary-cards .card:nth-child(1) .value').textContent = formatBRL(appState.saldo);
    document.querySelector('.summary-cards .card:nth-child(2) .value').textContent = formatBRL(appState.dividaBancaria);
    document.querySelector('.summary-cards .card:nth-child(3) .value').textContent = formatBRL(appState.lucroSemanal);
    document.querySelector('.summary-cards .card:nth-child(4) .value').textContent = formatBRL(appState.despesasSemanal);
    
    const bankBalanceEl = document.getElementById('bank-current-balance');
    if (bankBalanceEl) bankBalanceEl.textContent = formatBRL(appState.saldo);

    appState.frota = appState.caminhoes ? appState.caminhoes.length : 0;
    
    // Atualizar grid de frota
    const garagesCount = appState.garagens ? appState.garagens.length : 0;
    const trailersCount = appState.reboques ? appState.reboques.length : 0;
    const employeesCount = appState.funcionarios ? appState.funcionarios.length : 0;

    document.getElementById('stat-garages').textContent = garagesCount;
    document.getElementById('stat-trucks').textContent = appState.frota;
    document.getElementById('stat-trailers').textContent = trailersCount;
    document.getElementById('stat-employees').textContent = employeesCount;

    renderLists();
}

function renderLists() {
    const formatBRL = (value) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    let alocacao = [];

    // Extrato
    const finList = document.getElementById('finance-list');
    if (finList) {
        finList.innerHTML = '';
        if (appState.transacoes.length === 0) {
            finList.innerHTML = '<p style="color: var(--text-secondary);">Nenhuma transação registrada ainda.</p>';
        } else {
            // Mostrar de trás pra frente (mais recente primeiro)
            [...appState.transacoes].reverse().forEach(t => {
                finList.innerHTML += `
                <div class="list-item">
                    <div style="flex-grow: 1; min-width: 0;">
                        <div class="item-title">${t.descricao}</div>
                        <div class="item-subtitle">${t.data}</div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div style="font-weight: 700; white-space: nowrap; font-size: 0.95rem; color: var(${t.tipo === 'receita' ? '--accent-green' : '--accent-red'})">
                            ${t.tipo === 'receita' ? '+' : '-'} ${formatBRL(t.valor)}
                        </div>
                        <button onclick="editarTransacao(${t.id})" style="background: none; border: none; color: var(--text-secondary); font-size: 1.1rem; cursor: pointer;" title="Corrigir Valor">
                            <i class="fa fa-edit"></i>
                        </button>
                    </div>
                </div>`;
            });
        }
    }

    // Garagens
    const garageList = document.getElementById('garage-list');
    if (garageList) {
        garageList.innerHTML = '';
        if (!appState.garagens || appState.garagens.length === 0) {
            garageList.innerHTML = '<p style="color: var(--text-secondary);">Nenhuma garagem.</p>';
        } else {
            appState.garagens.forEach((g, index) => {
                const isSede = String(g.id) === "1" || index === 0;
                const btnVenderG = !isSede ? `<button onclick="venderGaragem(${g.id})" style="background: none; border: none; color: var(--accent-red); font-size: 1.2rem; cursor: pointer; padding-left: 10px;" title="Vender Garagem"><i class="fa fa-dollar-sign"></i></button>` : '';
                const btnMapa = isSede ? `<button onclick="openMapModal()" style="background: none; border: none; color: var(--accent-blue); font-size: 1.5rem; cursor: pointer; padding-left: 10px;" title="Ver Mapa"><i class="fa fa-map-marked-alt"></i></button>` : '';
                const btnAmpliarG = `<button onclick="openGarageModal('${g.id}')" style="background: none; border: none; color: var(--accent-green); font-size: 1.2rem; cursor: pointer; padding-left: 10px;" title="Ampliar Garagem"><i class="fa fa-arrow-up"></i></button>`;

                let cidadeDisplay = g.cidade;
                if (isSede && !cidadeDisplay.includes('Matriz')) {
                    cidadeDisplay += ' (Matriz)';
                } else if (!isSede && !cidadeDisplay.toLowerCase().includes('filial')) {
                    const filialNum = String(index).padStart(2, '0');
                    cidadeDisplay += ` (Filial ${filialNum})`;
                }
                
                garageList.innerHTML += `
                <div class="list-item">
                    <div style="flex-grow: 1; min-width: 0;">
                        <div class="item-title"><i class="fa fa-map-marker-alt"></i> ${cidadeDisplay}</div>
                        <div class="item-subtitle">${g.tipo} | Capacidade: ${g.capacidade} vagas</div>
                    </div>
                    ${btnAmpliarG}
                    ${btnVenderG}
                    ${btnMapa}
                </div>`;
            });
        }
    }

    // Frota
    const truckList = document.getElementById('truck-list');
    if (truckList) {
        truckList.innerHTML = '';
        if (!appState.caminhoes || appState.caminhoes.length === 0) {
            truckList.innerHTML = '<p style="color: var(--text-secondary);">Nenhum caminhão na garagem. Vá à concessionária!</p>';
        } else {
            let sortedCaminhoes = [...appState.caminhoes].sort((a, b) => {
                let gA = -1; let gB = -1;
                if (appState.garagens) {
                    gA = appState.garagens.findIndex(g => g.cidade.trim().toLowerCase() === (a.cidade || '').trim().toLowerCase());
                    gB = appState.garagens.findIndex(g => g.cidade.trim().toLowerCase() === (b.cidade || '').trim().toLowerCase());
                }
                if (gA === -1) gA = 999;
                if (gB === -1) gB = 999;
                return gA - gB;
            });
            let lastGarageDisplay = null;
            sortedCaminhoes.forEach(c => {
                let locationDisplay = c.cidade || 'Sem Garagem';
                if (c.cidade && appState.garagens) {
                    const gIndex = appState.garagens.findIndex(g => g.cidade.trim().toLowerCase() === c.cidade.trim().toLowerCase());
                    if (gIndex === 0 && !c.cidade.includes('Matriz')) {
                        locationDisplay = `${c.cidade} - Matriz`;
                    } else if (gIndex > 0 && !c.cidade.toLowerCase().includes('filial')) {
                        const filialNum = String(gIndex).padStart(2, '0');
                        locationDisplay = `${c.cidade} - Filial ${filialNum}`;
                    }
                }

                if (lastGarageDisplay !== locationDisplay) {
                    truckList.innerHTML += `<div style="width: 100%; text-align: center; margin: 15px 0 10px 0; font-weight: bold; color: #ffffff; text-shadow: 0 0 6px rgba(255,255,255,0.3); text-transform: uppercase; font-size: 0.85rem; letter-spacing: 1px; border-bottom: 1px dashed var(--border-color); padding-bottom: 5px;"><i class="fa fa-map-marker-alt"></i> ${locationDisplay}</div>`;
                    lastGarageDisplay = locationDisplay;
                }

                let motoristaDisplay = '';
                if(c.motoristaId) {
                    const mot = appState.funcionarios.find(f => String(f.id) === String(c.motoristaId));
                    if(mot) motoristaDisplay = ` | Mot: <span style="color:var(--accent-green);font-weight:bold;">${mot.nome}</span>`;
                }
                
                let reboqueDisplay = '';
                if(appState.reboques) {
                    const r = appState.reboques.find(r => String(r.caminhaoId) === String(c.id));
                    if(r) reboqueDisplay = `<br>Reboque atrelado: <span style="color:var(--accent-blue);font-weight:bold;">${r.modelo}</span>`;
                }

                truckList.innerHTML += `
                <div class="list-item">
                    <div style="flex-grow: 1; min-width: 0;">
                        <div class="item-title"><i class="fa fa-truck"></i> ${c.modelo}</div>
                        <div class="item-subtitle" onclick="transferirCaminhao(${c.id})" style="cursor: pointer;" title="Transferir de Cidade">Placa: ${c.placa || 'Sem Placa'} | Local: ${locationDisplay} <i class="fa fa-exchange-alt" style="margin-left: 5px; opacity: 0.5;"></i>${motoristaDisplay} | Comprado: ${c.data}${reboqueDisplay}</div>
                    </div>
                    <button onclick="openLinkEquipmentModal(${c.id}, 'truck')" style="background: none; border: none; color: var(--accent-green); font-size: 1.2rem; cursor: pointer; padding-left: 10px;" title="Engatar Reboque">
                        <i class="fa fa-link"></i>
                    </button>
                    <button onclick="repararCaminhao(${c.id})" style="background: none; border: none; color: var(--accent-blue); font-size: 1.2rem; cursor: pointer; padding-left: 10px;" title="Reparar/Manutenção">
                        <i class="fa fa-wrench"></i>
                    </button>
                    <button onclick="venderCaminhao(${c.id})" style="background: none; border: none; color: var(--accent-red); font-size: 1.2rem; cursor: pointer; padding-left: 10px;" title="Vender Caminhão">
                        <i class="fa fa-dollar-sign"></i>
                    </button>
                </div>`;
            });
        }
    }

    // Reboques
    const trailerList = document.getElementById('trailer-list');
    if (trailerList) {
        trailerList.innerHTML = '';
        if (!appState.reboques || appState.reboques.length === 0) {
            trailerList.innerHTML = '<p style="color: var(--text-secondary);">Nenhum reboque na garagem.</p>';
        } else {
            let sortedReboques = [...appState.reboques].sort((a, b) => {
                let gA = -1; let gB = -1;
                if (appState.garagens) {
                    gA = appState.garagens.findIndex(g => g.cidade.trim().toLowerCase() === (a.cidade || '').trim().toLowerCase());
                    gB = appState.garagens.findIndex(g => g.cidade.trim().toLowerCase() === (b.cidade || '').trim().toLowerCase());
                }
                if (gA === -1) gA = 999;
                if (gB === -1) gB = 999;
                return gA - gB;
            });
            let lastTrailerGarageDisplay = null;
            sortedReboques.forEach(r => {
                let locationDisplay = r.cidade || 'Sem Garagem';
                if (r.cidade && appState.garagens) {
                    const gIndex = appState.garagens.findIndex(g => g.cidade.trim().toLowerCase() === r.cidade.trim().toLowerCase());
                    if (gIndex === 0 && !r.cidade.includes('Matriz')) {
                        locationDisplay = `${r.cidade} - Matriz`;
                    } else if (gIndex > 0 && !r.cidade.toLowerCase().includes('filial')) {
                        const filialNum = String(gIndex).padStart(2, '0');
                        locationDisplay = `${r.cidade} - Filial ${filialNum}`;
                    }
                }

                if (lastTrailerGarageDisplay !== locationDisplay) {
                    trailerList.innerHTML += `<div style="width: 100%; text-align: center; margin: 15px 0 10px 0; font-weight: bold; color: #ffffff; text-shadow: 0 0 6px rgba(255,255,255,0.3); text-transform: uppercase; font-size: 0.85rem; letter-spacing: 1px; border-bottom: 1px dashed var(--border-color); padding-bottom: 5px;"><i class="fa fa-map-marker-alt"></i> ${locationDisplay}</div>`;
                    lastTrailerGarageDisplay = locationDisplay;
                }

                let truckDisplay = '';
                if(r.caminhaoId) {
                    const cam = appState.caminhoes.find(c => String(c.id) === String(r.caminhaoId));
                    if(cam) truckDisplay = ` | Atrelado ao: <span style="color:var(--accent-blue);font-weight:bold;">${cam.modelo} (${cam.placa || 'Sem Placa'})</span>`;
                }

                trailerList.innerHTML += `
                <div class="list-item">
                    <div style="flex-grow: 1; min-width: 0;">
                        <div class="item-title"><i class="fa fa-trailer"></i> ${r.modelo}</div>
                        <div class="item-subtitle" onclick="transferirReboque(${r.id})" style="cursor: pointer;" title="Transferir de Cidade">Local: ${locationDisplay} <i class="fa fa-exchange-alt" style="margin-left: 5px; opacity: 0.5;"></i>${truckDisplay} | Comprado em: ${r.data}</div>
                    </div>
                    <button onclick="openLinkEquipmentModal(${r.id}, 'trailer')" style="background: none; border: none; color: var(--accent-green); font-size: 1.2rem; cursor: pointer; padding-left: 10px;" title="Engatar em Caminhão">
                        <i class="fa fa-link"></i>
                    </button>
                    <button onclick="repararReboque(${r.id})" style="background: none; border: none; color: var(--accent-blue); font-size: 1.2rem; cursor: pointer; padding-left: 10px;" title="Reparar/Manutenção">
                        <i class="fa fa-wrench"></i>
                    </button>
                    <button onclick="venderReboque(${r.id})" style="background: none; border: none; color: var(--accent-red); font-size: 1.2rem; cursor: pointer; padding-left: 10px;" title="Vender Reboque">
                        <i class="fa fa-dollar-sign"></i>
                    </button>
                </div>`;
            });
        }
    }

    // Equipe
    const teamList = document.getElementById('team-list');
    if (teamList) {
        teamList.innerHTML = '';
        if (!appState.funcionarios || appState.funcionarios.length === 0) {
            teamList.innerHTML = '<p style="color: var(--text-secondary);">Sem motoristas.</p>';
        } else {
            let sortedFuncionarios = [...appState.funcionarios].sort((a, b) => {
                let gA = -1; let gB = -1;
                
                // Extrair cidade de a
                const matchA = a.cargo.match(/\((.*?)\)/);
                if (matchA && appState.garagens) {
                    const cidA = matchA[1].trim();
                    gA = appState.garagens.findIndex(g => g.cidade.trim().toLowerCase() === cidA.toLowerCase());
                }
                
                // Extrair cidade de b
                const matchB = b.cargo.match(/\((.*?)\)/);
                if (matchB && appState.garagens) {
                    const cidB = matchB[1].trim();
                    gB = appState.garagens.findIndex(g => g.cidade.trim().toLowerCase() === cidB.toLowerCase());
                }
                
                if (a.cargo.includes('Proprietário')) gA = -2;
                if (b.cargo.includes('Proprietário')) gB = -2;
                if (gA === -1) gA = 999;
                if (gB === -1) gB = 999;
                return gA - gB;
            });
            let lastTeamGarageDisplay = null;
            sortedFuncionarios.forEach(f => {
                const isOwner = f.cargo.includes('Proprietário');
                const btnDemitir = !isOwner ? `<button onclick="demitirMotorista(${f.id})" style="background: none; border: none; color: var(--accent-red); font-size: 1.2rem; cursor: pointer; padding-left: 10px;" title="Demitir Motorista"><i class="fa fa-user-times"></i></button>` : '';

                const clickWage = !isOwner ? `onclick="openDriverWageModal(${f.id}, '${f.nome}', ${f.salario})"` : '';
                const cursorStyle = !isOwner ? 'pointer' : 'default';

                let cargoDisplay = f.cargo;
                let locDisplayForDivider = 'Sem Garagem';
                
                if (isOwner) {
                    locDisplayForDivider = 'Diretoria';
                } else {
                    const match = f.cargo.match(/\((.*?)\)/);
                    if (match && appState.garagens) {
                        const cidadeStr = match[1].trim();
                        const gIndex = appState.garagens.findIndex(g => g.cidade.trim().toLowerCase() === cidadeStr.toLowerCase());
                        if (gIndex === 0 && !cidadeStr.includes('Matriz')) {
                            cargoDisplay = `Motorista (${cidadeStr} - Matriz)`;
                            locDisplayForDivider = `${cidadeStr} - Matriz`;
                        } else if (gIndex > 0 && !cidadeStr.toLowerCase().includes('filial')) {
                            const filialNum = String(gIndex).padStart(2, '0');
                            cargoDisplay = `Motorista (${cidadeStr} - Filial ${filialNum})`;
                            locDisplayForDivider = `${cidadeStr} - Filial ${filialNum}`;
                        } else {
                            locDisplayForDivider = cidadeStr;
                        }
                    }
                }

                if (lastTeamGarageDisplay !== locDisplayForDivider) {
                    const iconType = isOwner ? 'fa-building' : 'fa-map-marker-alt';
                    teamList.innerHTML += `<div style="width: 100%; text-align: center; margin: 15px 0 10px 0; font-weight: bold; color: #ffffff; text-shadow: 0 0 6px rgba(255,255,255,0.3); text-transform: uppercase; font-size: 0.85rem; letter-spacing: 1px; border-bottom: 1px dashed var(--border-color); padding-bottom: 5px;"><i class="fa ${iconType}"></i> ${locDisplayForDivider}</div>`;
                    lastTeamGarageDisplay = locDisplayForDivider;
                }

                let currentTruck = null;
                let currentTrailer = null;
                if (appState.caminhoes) {
                    currentTruck = appState.caminhoes.find(c => String(c.motoristaId) === String(f.id));
                }
                if (currentTruck && appState.reboques) {
                    currentTrailer = appState.reboques.find(r => String(r.caminhaoId) === String(currentTruck.id));
                }
                
                let truckHtml = '';
                if (currentTruck) {
                    truckHtml += ` <span style="white-space: nowrap;"><span style="font-size: 0.85rem; color: var(--accent-blue);">(${currentTruck.placa})</span>`;
                    truckHtml += ` <i class="fa fa-key" style="color: var(--accent-green); margin-left: 5px; font-size: 0.9rem;" title="Possui Caminhão"></i>`;
                    if (currentTrailer) {
                        truckHtml += ` <i class="fa fa-trailer" style="color: var(--accent-blue); margin-left: 5px; font-size: 0.9rem;" title="Possui Reboque Acoplado"></i>`;
                    }
                    truckHtml += `</span>`;
                }

                teamList.innerHTML += `
                <div class="list-item">
                    <div style="width: 60px; height: 60px; border-radius: 12px; background-color: var(--bg-main); display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0; border: 2px solid var(--border-color); cursor: ${cursorStyle}; margin-right: 5px;" title="${!isOwner ? 'Motorista Automatizado' : ''}">
                        <img src="assets/motoristas/${f.nome.replace(/ /g, '_')}.png" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                        <i class="fa fa-user" style="font-size: 1.5rem; color: var(--text-secondary); display: none;"></i>
                    </div>
                    <div style="flex-grow: 1; min-width: 0;">
                        <div class="item-title" style="cursor: ${cursorStyle}; display: flex; align-items: center; gap: 10px;" title="${!isOwner ? 'Motorista Automatizado' : ''}">
                            <span style="font-size: 1.1rem;">${f.nome}${truckHtml}</span> 
                            ${!isOwner ? `<button onclick="renomearMotorista(event, ${f.id})" style="background: none; border: none; color: var(--text-secondary); margin-left: auto; cursor: pointer;" title="Editar Nome"><i class="fa fa-pen" style="font-size: 0.8rem;"></i></button>` : ''}
                        </div>
                        <div class="item-subtitle" ${!isOwner ? `onclick="transferirMotorista(${f.id})" style="cursor: pointer;" title="Transferir de Cidade"` : ''}>${cargoDisplay} ${!isOwner ? '<i class="fa fa-exchange-alt" style="margin-left: 5px; opacity: 0.5;"></i>' : ''}</div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div style="color: var(--text-secondary); font-size: 0.85rem; text-align: right; cursor: ${cursorStyle};" ${clickWage} title="${!isOwner ? 'Ajustar Diária' : ''}">
                            ${f.salario > 0 ? formatBRL(f.salario) + '/dia' + (!isOwner ? ' <i class="fa fa-edit"></i>' : '') : 'Lucro Líquido'}
                        </div>
                        ${!isOwner ? `<button onclick="openAssignTruckModal(${f.id})" style="background: none; border: none; color: var(--accent-green); font-size: 1.2rem; cursor: pointer; padding-left: 10px;" title="Entregar Chave (Atribuir Caminhão)"><i class="fa fa-key"></i></button>` : ''}
                        ${!isOwner ? `<button onclick="openDriverProfileView(${f.id})" style="background: none; border: none; color: var(--accent-blue); font-size: 1.2rem; cursor: pointer; padding-left: 10px;" title="Painel do Motorista"><i class="fa fa-chart-bar"></i></button>` : ''}
                        ${btnDemitir}
                    </div>
                </div>`;
            });
        }
    }
    
    renderInventario();
}

// Renomear Motorista
window.renomearMotorista = function(event, id) {
    if (event) event.stopPropagation(); // Impede de abrir o modal de Viagem ao clicar no ícone de lápis
    
    const index = appState.funcionarios.findIndex(f => f.id === id);
    if (index === -1) return;
    
    const driver = appState.funcionarios[index];
    const novoNome = prompt(`Editar nome do motorista:\n(Nome atual: ${driver.nome})`, driver.nome);
    
    if (novoNome !== null && novoNome.trim() !== '') {
        const formatName = (str) => {
            const preposicoes = ["da", "de", "do", "das", "dos", "e"];
            return str.toLowerCase().split(' ').map((word, i) => {
                if (i !== 0 && preposicoes.includes(word)) return word;
                return word.charAt(0).toUpperCase() + word.slice(1);
            }).join(' ').trim();
        };
        
        const nomeFormatado = formatName(novoNome);
        
        // Verificar duplicata (ignorando ele mesmo)
        const nameToCheck = nomeFormatado.toLowerCase().replace(/\s+/g, ' ');
        const exists = appState.funcionarios.find(f => {
            return f.id !== id && (f.nome ? f.nome.trim().toLowerCase().replace(/\s+/g, ' ') === nameToCheck : false);
        });
        
        if (exists) {
            customAlert(`Já existe um motorista com o nome ${nomeFormatado}!`, 'error');
            return;
        }
        
        driver.nome = nomeFormatado;
        customAlert('Nome do motorista atualizado!', 'success');
        saveState();
        updateDashboard();
    }
};

// Pre-visualizar a imagem do motorista durante a digitação
window.previewHireImage = function(val) {
    const formatName = (str) => {
        const preposicoes = ["da", "de", "do", "das", "dos", "e"];
        return str.toLowerCase().split(' ').map((word, i) => {
            if (i !== 0 && preposicoes.includes(word)) return word;
            return word.charAt(0).toUpperCase() + word.slice(1);
        }).join(' ').trim();
    };
    
    // Converte pra bater com o padrão de arquivos do usuário (espaços para underscores)
    const formatted = formatName(val).replace(/ /g, '_');
    
    const imgEl = document.getElementById('hire-preview-img');
    const iconEl = document.getElementById('hire-preview-icon');
    
    if (formatted) {
        imgEl.src = `assets/motoristas/${formatted}.png`;
        imgEl.style.display = 'block';
        iconEl.style.display = 'none';
        
        imgEl.onerror = function() {
            this.style.display = 'none';
            iconEl.style.display = 'block';
        };
    } else {
        imgEl.style.display = 'none';
        iconEl.style.display = 'block';
    }
}

// Controle do Modal
const modal = document.getElementById('transaction-modal');
const modalTitle = document.getElementById('modal-title');
const typeInput = document.getElementById('trans-type');
const transactionForm = document.getElementById('transaction-form');

function openModal(type) {
    typeInput.value = type;
    const catContainer = document.getElementById('trans-category-container');
    const catSelect = document.getElementById('trans-category');
    
    if (type === 'receita') {
        modalTitle.textContent = 'Registrar Novo Frete (Ganhos)';
        modalTitle.style.color = 'var(--accent-green)';
        document.querySelector('#transaction-modal .btn-confirm').style.backgroundColor = 'var(--accent-green)';
        if (catContainer) catContainer.style.display = 'none';
    } else {
        modalTitle.textContent = 'Registrar Despesa ou Bônus';
        modalTitle.style.color = 'var(--accent-red)';
        document.querySelector('#transaction-modal .btn-confirm').style.backgroundColor = 'var(--accent-red)';
        if (catContainer) {
            catContainer.style.display = 'block';
            catSelect.value = 'despesa'; // Reset default
            // Trigger color update check
            catSelect.dispatchEvent(new Event('change'));
        }
    }
    
    // Add event listener for category change only once (or rely on inline/global)
    if (catSelect && !catSelect.dataset.listenerAdded) {
        catSelect.addEventListener('change', (e) => {
            if (e.target.value === 'bonus') {
                modalTitle.style.color = 'var(--accent-green)';
                document.querySelector('#transaction-modal .btn-confirm').style.backgroundColor = 'var(--accent-green)';
            } else {
                modalTitle.style.color = 'var(--accent-red)';
                document.querySelector('#transaction-modal .btn-confirm').style.backgroundColor = 'var(--accent-red)';
            }
        });
        catSelect.dataset.listenerAdded = 'true';
    }
    
    modal.classList.remove('hidden');
}

window.openBankModal = function() {
    window.renderActiveLoans();
    document.getElementById('bank-modal').classList.remove('hidden');
};

window.renderActiveLoans = function() {
    const list = document.getElementById('active-loans-list');
    if (!list) return;
    list.innerHTML = '';
    
    if (!appState.emprestimos) appState.emprestimos = [];
    
    if (appState.dividaBancaria > 0 && appState.emprestimos.length === 0) {
        appState.emprestimos.push({
            id: Date.now(),
            data: new Date().toLocaleDateString('pt-BR'),
            valorOriginal: appState.dividaBancaria,
            saldoDevedor: appState.dividaBancaria
        });
    }
    
    if (appState.emprestimos.length === 0) {
        list.innerHTML = '<p style="color: var(--text-secondary); font-size: 0.85rem;">Nenhum empréstimo ativo no momento.</p>';
        return;
    }
    
    appState.emprestimos.forEach(emp => {
        list.innerHTML += `
        <div class="list-item" style="border-left: 3px solid var(--accent-red); margin-bottom: 8px;">
            <div style="flex-grow: 1;">
                <div class="item-title" style="font-size: 0.95rem;">Empréstimo: R$ ${emp.valorOriginal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</div>
                <div class="item-subtitle" style="font-size: 0.8rem; margin-top: 4px;">Data: ${emp.data}</div>
                <div class="item-subtitle" style="font-size: 0.85rem; margin-top: 5px; color: var(--accent-red); font-weight: bold;">
                    Resta pagar: R$ ${emp.saldoDevedor.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                </div>
            </div>
            <div style="text-align: right; display: flex; align-items: center; justify-content: flex-end; padding-left: 10px;">
                <button type="button" onclick="pagarEmprestimo(${emp.id})" style="background-color: var(--accent-blue); padding: 0.4rem 0.8rem; font-size: 0.85rem; border-radius: 6px; cursor: pointer; border: none; color: white;">Pagar</button>
            </div>
        </div>
        `;
    });
};

window.pagarEmprestimo = function(id) {
    const ind = appState.emprestimos.findIndex(e => String(e.id) === String(id));
    if (ind !== -1) {
        const emp = appState.emprestimos[ind];
        customPromptNumber(
            'Pagar Empréstimo',
            `Saldo Devedor: R$ ${emp.saldoDevedor.toLocaleString('pt-BR', {minimumFractionDigits: 2})}\nQual valor você deseja pagar agora? (Digite ${emp.saldoDevedor.toFixed(2)} para quitar tudo)`,
            emp.saldoDevedor.toFixed(2),
            (valStr) => {
                if (valStr !== null) {
                    const v = parseFloat(valStr.replace(',', '.'));
                    if (isNaN(v) || v <= 0) {
                        customAlert("Valor inválido.", "error");
                        return;
                    }
                    if (v > appState.saldo) {
                        customAlert("Saldo insuficiente para pagar este valor!", "error");
                        return;
                    }
                    if (v > emp.saldoDevedor) {
                        customAlert(`O valor máximo para este empréstimo é R$ ${emp.saldoDevedor.toLocaleString('pt-BR', {minimumFractionDigits: 2})}.`, "error");
                        return;
                    }
                    
                    appState.saldo -= v;
                    appState.dividaBancaria -= v;
                    if (appState.dividaBancaria < 0) appState.dividaBancaria = 0;
                    
                    emp.saldoDevedor -= v;
                    
                    appState.transacoes.push({
                        id: Date.now(),
                        data: new Date().toLocaleDateString('pt-BR'),
                        descricao: 'Pagamento de Empréstimo',
                        valor: v,
                        tipo: 'despesa'
                    });
                    
                    if (emp.saldoDevedor <= 0) {
                        appState.emprestimos.splice(ind, 1);
                        customAlert(`Empréstimo quitado com sucesso!`, 'success');
                    } else {
                        customAlert(`Amortização de R$ ${v.toLocaleString('pt-BR', {minimumFractionDigits: 2})} realizada!`, 'success');
                    }
                    
                    saveState();
                    updateDashboard();
                    renderActiveLoans();
                }
            }
        );
    }
}

function openTruckModal() {
    const selectCity = document.getElementById('truck-garage');
    if(selectCity) {
        selectCity.innerHTML = '';
        if(appState.garagens) {
            appState.garagens.forEach(g => {
                selectCity.innerHTML += `<option value="${g.cidade}">${g.cidade}</option>`;
            });
        }
    }
    if (typeof window.updateTruckDriverSelect === 'function') window.updateTruckDriverSelect();
    document.getElementById('truck-modal').classList.remove('hidden');
}

function openGarageModal(id = '') {
    document.getElementById('upgrade-garage-id').value = id;
    
    const selectAcao = document.getElementById('garage-action');
    if (id !== '') {
        const found = appState.garagens.find(g => String(g.id) === String(id));
        if (found) {
            if (found.capacidade >= 5) {
                customAlert("Esta garagem já está no seu tamanho máximo (5 vagas)!", "error");
                return;
            }
            if (found.capacidade < 3) {
                selectAcao.innerHTML = `<option value="180000|Melhoria p/ Média (3 Vagas)|false">Melhoria: Pequena p/ Média (3 Vagas)</option>`;
            } else {
                selectAcao.innerHTML = `<option value="586000|Melhoria p/ Grande (5 Vagas)|false">Melhoria: Média p/ Grande (5 Vagas)</option>`;
            }
        }
    } else {
        // Modo Comprar Nova (+ Garagem global)
        selectAcao.innerHTML = `
            <option value="180000|Nova Garagem (3 Vagas)|true">Comprar Nova Garagem Média</option>
        `;
    }
    
    if (typeof window.toggleCityInput === 'function') {
        window.toggleCityInput();
    }
    
    document.getElementById('garage-modal').classList.remove('hidden');
}

function openTrailerModal() {
    const selectCity = document.getElementById('trailer-garage');
    if(selectCity) {
        selectCity.innerHTML = '';
        if(appState.garagens) {
            appState.garagens.forEach(g => {
                selectCity.innerHTML += `<option value="${g.cidade}">${g.cidade}</option>`;
            });
        }
    }
    if (typeof window.updateTrailerTruckSelect === 'function') window.updateTrailerTruckSelect();
    document.getElementById('trailer-modal').classList.remove('hidden');
}

function openDriverModal() {
    const selectCity = document.getElementById('driver-city');
    selectCity.innerHTML = '';
    if(appState.garagens) {
        appState.garagens.forEach(g => {
            selectCity.innerHTML += `<option value="${g.cidade}">${g.cidade}</option>`;
        });
    }
    if (typeof window.updateDriverTruckSelect === 'function') window.updateDriverTruckSelect();
    document.getElementById('driver-modal').classList.remove('hidden');
}

function openMapModal() {
    document.getElementById('map-modal').classList.remove('hidden');
    // Scrollar automaticamente para o meio do mapa
    setTimeout(() => {
        const container = document.getElementById('map-scroll-area');
        if(container) {
            container.scrollLeft = (container.scrollWidth - container.clientWidth) / 2;
            container.scrollTop = (container.scrollHeight - container.clientHeight) / 2;
        }
    }, 100);
}

window.openAssignTruckModal = function(driverId) {
    const fIndex = appState.funcionarios.findIndex(f => String(f.id) === String(driverId));
    if (fIndex === -1) return;
    const f = appState.funcionarios[fIndex];

    const isOwner = f.cargo.includes('Proprietário');
    let driverCity = '';
    const match = f.cargo.match(/\((.*?)\)/);
    if (match) {
        driverCity = match[1].trim();
    } else if (isOwner && appState.garagens && appState.garagens.length > 0) {
        driverCity = appState.garagens[0].cidade.trim();
    }

    document.getElementById('assign-driver-id').value = f.id;
    document.getElementById('assign-driver-city').value = driverCity;
    document.getElementById('assign-truck-desc').innerHTML = `Motorista: <strong>${f.nome}</strong><br>Local: ${driverCity}`;
    
    const selectTruck = document.getElementById('assign-truck-select');
    selectTruck.innerHTML = '<option value="">(Remover Caminhão / Nenhum)</option>';
    
    let currentTruckId = null;

    if (appState.caminhoes) {
        const truckLivres = appState.caminhoes.filter(c => c.cidade.trim() === driverCity && (!c.motoristaId || String(c.motoristaId) === String(f.id)));
        truckLivres.forEach(c => {
            let label = `${c.modelo} (${c.placa})`;
            if (String(c.motoristaId) === String(f.id)) {
                label += ` - (Caminhão Atual)`;
                currentTruckId = c.id; 
            }
            selectTruck.innerHTML += `<option value="${c.id}">${label}</option>`;
        });
    }

    if (currentTruckId) {
        selectTruck.value = currentTruckId;
    }

    const selectTrailer = document.getElementById('assign-trailer-select');
    if (selectTrailer) {
        selectTrailer.innerHTML = '<option value="">(Remover Reboque / Nenhum)</option>';
        if (appState.reboques) {
            const trailersLivres = appState.reboques.filter(r => r.cidade.trim() === driverCity && (!r.caminhaoId || (currentTruckId && String(r.caminhaoId) === String(currentTruckId))));
            trailersLivres.forEach(r => {
                let label = `${r.modelo}`;
                if (currentTruckId && String(r.caminhaoId) === String(currentTruckId)) {
                    label += ` - (Reboque Atual)`;
                    selectTrailer.value = r.id;
                }
                selectTrailer.innerHTML += `<option value="${r.id}">${label}</option>`;
            });
        }
    }

    document.getElementById('assign-truck-modal').classList.remove('hidden');
};

window.openLinkEquipmentModal = function(id, type) {
    let sourceCity = '';
    let sourceName = '';
    
    document.getElementById('link-source-id').value = id;
    document.getElementById('link-source-type').value = type;
    
    const selectTarget = document.getElementById('link-target-select');
    selectTarget.innerHTML = '';
    
    if (type === 'truck') {
        const tr = appState.caminhoes.find(c => String(c.id) === String(id));
        if(!tr) return;
        sourceCity = tr.cidade.trim();
        sourceName = `Caminhão: <strong>${tr.modelo} (${tr.placa})</strong>`;
        
        document.getElementById('link-target-label').innerText = 'Selecionar Reboque (Livre na Garagem)';
        selectTarget.innerHTML = '<option value="">(Desatrelar Reboque / Nenhum)</option>';
        
        if (appState.reboques) {
            const reboquesNaCidade = appState.reboques.filter(r => r.cidade.trim() === sourceCity && (!r.caminhaoId || String(r.caminhaoId) === String(id)));
            reboquesNaCidade.forEach(r => {
                let label = `${r.modelo}`;
                if (String(r.caminhaoId) === String(id)) {
                    label += ' - (Atual)';
                    selectTarget.value = r.id;
                }
                selectTarget.innerHTML += `<option value="${r.id}">${label}</option>`;
            });
        }
    } else if (type === 'trailer') {
        const rb = appState.reboques.find(r => String(r.id) === String(id));
        if(!rb) return;
        sourceCity = rb.cidade.trim();
        sourceName = `Reboque: <strong>${rb.modelo}</strong>`;
        
        document.getElementById('link-target-label').innerText = 'Engatar em Caminhão (Livre na Garagem)';
        selectTarget.innerHTML = '<option value="">(Desatrelar do Caminhão / Nenhum)</option>';
        
        if (appState.caminhoes) {
            const path = appState.caminhoes.filter(c => c.cidade.trim() === sourceCity);
            path.forEach(c => {
                const isAttachedToThis = String(rb.caminhaoId) === String(c.id);
                // Allow selecting ANY truck in the city (if it has another trailer, it gets swapped out by the submit logic)
                let label = `${c.modelo} (${c.placa})`;
                if (isAttachedToThis) {
                    label += ' - (Atual)';
                    selectTarget.innerHTML += `<option value="${c.id}" selected>${label}</option>`;
                } else {
                    const hasOtherTrailer = appState.reboques.find(r => String(r.caminhaoId) === String(c.id));
                    if (hasOtherTrailer) label += ' - (Já Ocupado)';
                    selectTarget.innerHTML += `<option value="${c.id}">${label}</option>`;
                }
            });
        }
    }
    
    document.getElementById('link-equipment-desc').innerHTML = `${sourceName}<br>Local: ${sourceCity}`;
    document.getElementById('link-equipment-modal').classList.remove('hidden');
};

function closeModal(modalId) {
    if(!modalId) modalId = 'transaction-modal';
    const targetModal = document.getElementById(modalId);
    targetModal.classList.add('hidden');
    
    if (modalId === 'transaction-modal') {
        transactionForm.reset();
    } else if (modalId === 'bank-modal') {
        document.getElementById('bank-form').reset();
    } else if (modalId === 'truck-modal') {
        document.getElementById('truck-form').reset();
    } else if (modalId === 'garage-modal') {
        document.getElementById('garage-form').reset();
    } else if (modalId === 'trailer-modal') {
        document.getElementById('trailer-form').reset();
    } else if (modalId === 'driver-modal') {
        document.getElementById('driver-form').reset();
    } else if (modalId === 'driver-trip-modal') {
        document.getElementById('driver-trip-form').reset();
    } else if (modalId === 'driver-wage-modal') {
        document.getElementById('driver-wage-form').reset();
    }
}

let currentNumberPromptCallback = null;

window.customPromptNumber = function(title, message, defaultValue, callback) {
    const modal = document.getElementById('number-prompt-modal');
    if (!modal) return;
    
    document.getElementById('number-prompt-title').innerHTML = `<i class="fa fa-keyboard"></i> ${title}`;
    document.getElementById('number-prompt-msg').innerText = message;
    
    const inputEl = document.getElementById('number-prompt-input');
    inputEl.value = defaultValue || "";
    
    currentNumberPromptCallback = callback;
    modal.classList.remove('hidden');
    inputEl.focus();
};

window.closeNumberPrompt = function() {
    document.getElementById('number-prompt-modal').classList.add('hidden');
    if (currentNumberPromptCallback) {
        currentNumberPromptCallback(null);
        currentNumberPromptCallback = null;
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('number-prompt-form');
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const val = document.getElementById('number-prompt-input').value;
            document.getElementById('number-prompt-modal').classList.add('hidden');
            if (currentNumberPromptCallback) {
                currentNumberPromptCallback(val);
                currentNumberPromptCallback = null;
            }
        });
    }

    const textForm = document.getElementById('text-prompt-form');
    if (textForm) {
        textForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const val = document.getElementById('text-prompt-input').value;
            document.getElementById('text-prompt-modal').classList.add('hidden');
            if (currentTextPromptCallback) {
                currentTextPromptCallback(val);
                currentTextPromptCallback = null;
            }
        });
    }
});

let currentTextPromptCallback = null;

window.customPromptText = function(title, message, defaultValue, callback) {
    const modal = document.getElementById('text-prompt-modal');
    if (!modal) return;
    
    document.getElementById('text-prompt-title').innerHTML = `<i class="fa fa-keyboard"></i> ${title}`;
    document.getElementById('text-prompt-msg').innerText = message;
    
    const inputEl = document.getElementById('text-prompt-input');
    inputEl.value = defaultValue || "";
    
    currentTextPromptCallback = callback;
    modal.classList.remove('hidden');
    inputEl.focus();
};

window.closeTextPrompt = function() {
    document.getElementById('text-prompt-modal').classList.add('hidden');
    if (currentTextPromptCallback) {
        currentTextPromptCallback(null);
        currentTextPromptCallback = null;
    }
};

// Lógica de Navegação em Abas (SPA)
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        // Ignorar os botões especiais
        const btnText = e.currentTarget.innerText;
        if(btnText.includes('Recomeçar') || btnText.includes('Sincronizar')) return;
        
        // Remove active de todos
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        
        // Ocultar todas as views
        document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));
        
        // Mostrar a selecionada
        const targetText = e.currentTarget.innerText.trim().toLowerCase();
        
        if(targetText.includes('dashboard')) document.getElementById('view-dashboard').classList.add('active');
        if(targetText.includes('finanças')) document.getElementById('view-financas').classList.add('active');
        if(targetText.includes('inventário')) document.getElementById('view-inventario').classList.add('active');
        if(targetText.includes('frota')) document.getElementById('view-frota').classList.add('active');
        if(targetText.includes('equipe')) document.getElementById('view-equipe').classList.add('active');
        if(targetText.includes('contabilidade atk')) document.getElementById('view-contabilidade').classList.add('active');
        if(targetText.includes('apostila')) document.getElementById('view-apostila').classList.add('active');
    });
});

// Lógica de Scroll com o Mouse na Nav-Bar (Para o PC)
const navBar = document.querySelector('.main-nav');
let isDraggingNav = false;
let startX;
let scrollLeft;

navBar.addEventListener('mousedown', (e) => {
    isDraggingNav = true;
    navBar.style.cursor = 'grabbing';
    startX = e.pageX - navBar.offsetLeft;
    scrollLeft = navBar.scrollLeft;
});

window.addEventListener('mouseleave', () => {
    if(isDraggingNav) {
        isDraggingNav = false;
        navBar.style.cursor = 'default';
    }
});

window.addEventListener('mouseup', () => {
    if(isDraggingNav) {
        isDraggingNav = false;
        navBar.style.cursor = 'default';
    }
});

navBar.addEventListener('mousemove', (e) => {
    if (!isDraggingNav) return;
    e.preventDefault();
    const x = e.pageX - navBar.offsetLeft;
    const walk = (x - startX) * 2; // Multiplicador de velocidade
    navBar.scrollLeft = scrollLeft - walk;
});

navBar.addEventListener('wheel', (e) => {
    e.preventDefault();
    navBar.scrollLeft += e.deltaY;
});

// Botões de Ação
document.querySelector('.action-btn.success').addEventListener('click', () => openModal('receita'));
document.querySelector('.action-btn.danger').addEventListener('click', () => openModal('despesa'));
document.getElementById('btn-bank').addEventListener('click', openBankModal);

function customAlert(message, type = 'error') {
    Toastify({
        text: message,
        duration: 3000,
        close: true,
        gravity: "top", 
        position: "center", 
        style: {
            background: type === 'error' ? "var(--accent-red)" : "var(--accent-green)",
            borderRadius: "8px",
            fontFamily: "var(--font-main)"
        }
    }).showToast();
}

// Formulário do Banco
document.getElementById('bank-form').addEventListener('submit', (e) => {
    e.preventDefault();
    
    const value = parseFloat(document.getElementById('bank-value').value);

    if (isNaN(value) || value <= 0) {
        customAlert("Digite um valor válido maior que zero!");
        return;
    }

    appState.saldo += value;
    appState.dividaBancaria += value;
    
    if (!appState.emprestimos) appState.emprestimos = [];
    appState.emprestimos.push({
        id: Date.now(),
        data: new Date().toLocaleDateString('pt-BR'),
        valorOriginal: value,
        saldoDevedor: value
    });
    
    appState.transacoes.push({
        id: Date.now(),
        data: new Date().toLocaleDateString('pt-BR'),
        descricao: 'Empréstimo Bancário',
        valor: value,
        tipo: 'receita'
    });
    
    customAlert(`Empréstimo de R$ ${value.toLocaleString('pt-BR', {minimumFractionDigits: 2})} realizado!`, 'success');
    document.getElementById('bank-form').reset();

    saveState();
    updateDashboard();
    renderActiveLoans();
});

// Comprar Caminhão Form
document.getElementById('truck-form').addEventListener('submit', (e) => {
    e.preventDefault();
    
    // Garantir que as arrays existam para quem já tem save antigo
    if(!appState.caminhoes) appState.caminhoes = [];
    
    const condition = document.getElementById('truck-condition').value;
    const inputModel = document.getElementById('truck-model-input').value.trim();
    const valor = parseFloat(document.getElementById('truck-price').value);
    const garageSelected = document.getElementById('truck-garage').value;
    const motoristaId = document.getElementById('truck-driver') ? document.getElementById('truck-driver').value : '';
    
    if (isNaN(valor) || valor <= 0 || !inputModel) {
        customAlert("Preencha o modelo e informe um valor válido para o caminhão!", "error");
        return;
    }

    const modelo = `${inputModel} (${condition})`;

    const garagemDestino = appState.garagens.find(g => g.cidade === garageSelected);
    const caminhoesNaGaragem = appState.caminhoes.filter(c => c.cidade === garageSelected).length;

    if (!garagemDestino) {
        customAlert("Selecione uma garagem válida!", "error");
        return;
    }

    if (caminhoesNaGaragem >= garagemDestino.capacidade) {
        customAlert(`Sem vagas na garagem de ${garageSelected}! Capacidade máxima (${garagemDestino.capacidade}) atingida.`, "error");
        return;
    }

    if (valor > appState.saldo) {
        customAlert(`Saldo insuficiente! Custa R$ ${valor.toLocaleString('pt-BR')}. Vá ao banco.`, 'error');
        return;
    }

    appState.saldo -= valor;
    
    if (motoristaId !== '') {
        appState.caminhoes.forEach(c => {
            if (String(c.motoristaId) === String(motoristaId)) {
                c.motoristaId = null;
            }
        });
    }

    appState.caminhoes.push({
        id: Date.now(),
        modelo: modelo,
        cidade: garageSelected,
        motoristaId: motoristaId !== '' ? String(motoristaId) : null,
        placa: `ETS-${Math.floor(Math.random() * 9000) + 1000}`,
        data: new Date().toLocaleDateString('pt-BR')
    });

    appState.transacoes.push({
        id: Date.now(),
        data: new Date().toLocaleDateString('pt-BR'),
        descricao: `Compra de Caminhão: ${modelo}`,
        valor: valor,
        tipo: 'despesa'
    });

    customAlert(`Parabéns! ${modelo} adquirido com sucesso.`, 'success');

    saveState();
    updateDashboard();
    closeModal('truck-modal');
});

// Comprar Garagem Form
document.getElementById('garage-form').addEventListener('submit', (e) => {
    e.preventDefault();
    
    if(!appState.garagens) {
        appState.garagens = [ { id: 1, cidade: 'Cidade Sede', tipo: 'Pequena (1 Vaga)', capacidade: 1 } ];
    }
    
    const sel = document.getElementById('garage-action').value.split('|');
    const valor = parseFloat(document.getElementById('garage-price').value);
    const modelo = sel[1];
    const isNew = sel[2] === 'true';
    const cityInput = document.getElementById('garage-city').value;
    const targetIdStr = document.getElementById('upgrade-garage-id').value;

    let targetIndex = 0; // Default to Sede
    if (targetIdStr) {
        const found = appState.garagens.findIndex(g => String(g.id) === targetIdStr);
        if (found !== -1) targetIndex = found;
    }

    if (isNaN(valor) || valor < 0) {
        customAlert("Informe um valor válido para a garagem!", "error");
        return;
    }
    if (valor > appState.saldo) {
        customAlert(`Saldo insuficiente! Custa R$ ${valor.toLocaleString('pt-BR')}. Vá ao banco.`, 'error');
        return;
    }

    // Validation for upgrading
    if (!isNew) {
        if (modelo.includes('3 Vagas') && appState.garagens[targetIndex].capacidade >= 3) {
            customAlert("Esta garagem já tem 3 ou mais vagas!", "error");
            return;
        }
        if (modelo.includes('5 Vagas') && appState.garagens[targetIndex].capacidade < 3) {
            customAlert(`Você precisa melhorar a garagem de ${appState.garagens[targetIndex].cidade} para 3 vagas (Média) primeiro!`, "error");
            return;
        }
        if (modelo.includes('5 Vagas') && appState.garagens[targetIndex].capacidade >= 5) {
            customAlert("Esta garagem já está no tamanho máximo!", "error");
            return;
        }
    }

    appState.saldo -= valor;
    
    if (isNew) {
        appState.garagens.push({
            id: Date.now(),
            cidade: cityInput || `Nova Cidade ${appState.garagens.length + 1}`,
            tipo: 'Média (3 Vagas)',
            capacidade: 3
        });
    } else {
        // Atualiza a garagem alvo
        if(modelo.includes('3 Vagas')) {
            appState.garagens[targetIndex].tipo = 'Média (3 Vagas)';
            appState.garagens[targetIndex].capacidade = 3;
        } else if (modelo.includes('5 Vagas')) {
            appState.garagens[targetIndex].tipo = 'Grande (5 Vagas)';
            appState.garagens[targetIndex].capacidade = 5;
        }
    }

    appState.transacoes.push({
        id: Date.now(),
        data: new Date().toLocaleDateString('pt-BR'),
        descricao: `Imobiliária: ${modelo}`,
        valor: valor,
        tipo: 'despesa'
    });

    customAlert(`Parabéns! ${modelo} registrado com sucesso.`, 'success');

    saveState();
    updateDashboard();
    closeModal('garage-modal');
});

function gerarFretesAutomaticosParaMotoristas() {
    if (!appState.funcionarios || appState.funcionarios.length === 0) return;
    
    let totalLucroMotoristas = 0;
    const hoje = new Date().toLocaleDateString('pt-BR');
    
    // Lista de cargas comuns no ETS2 para dar imersão
    const cargas = ['Paletes Vazios', 'Plásticos Usados', 'Bobinas de Aço', 'Eletrônicos', 'Alimentos Enlatados', 'Tubos de Concreto', 'Medicamentos', 'Vergalhões de Ferro', 'Peças de Caminhão', 'Madeira Trabalhada', 'Baterias', 'Vidro', 'Cimento', 'Móveis'];

    appState.funcionarios.forEach(func => {
        const cargaAleatoria = cargas[Math.floor(Math.random() * cargas.length)];
        // Receita aleatória realista (R$ 2.500 a R$ 8.500)
        const receita = Math.floor(Math.random() * 6000) + 2500; 
        
        // Despesa (ex: 15% a 30% da receita para combustível, pedágio, manutenção)
        const percentualDespesa = (Math.floor(Math.random() * 16) + 15) / 100;
        const despesa = Math.floor(receita * percentualDespesa);
        
        let jaPagouHoje = false;
        if (func.historico) {
            jaPagouHoje = func.historico.some(h => h.data === hoje && h.wage > 0);
        }
        
        const wage = jaPagouHoje ? 0 : (func.salario || 0); // Diária
        
        const lucroFinal = receita - despesa - wage;
        
        appState.saldo += lucroFinal;
        appState.lucroSemanal += receita;
        appState.despesasSemanal += (despesa + wage);
        
        appState.transacoes.push({
            id: Date.now() + Math.random(),
            data: hoje,
            descricao: `Trabalho Automático: ${func.nome}`,
            valor: Math.abs(lucroFinal),
            tipo: lucroFinal >= 0 ? 'receita' : 'despesa'
        });
        
        if(!func.historico) func.historico = [];
        func.historico.push({
            id: Date.now() + Math.random(),
            data: hoje,
            descricao: cargaAleatoria,
            receita: receita,
            despesa: despesa,
            wage: wage,
            lucroFinal: lucroFinal
        });
        
        totalLucroMotoristas += lucroFinal;
    });
    
    setTimeout(() => {
        if (totalLucroMotoristas >= 0) {
            customAlert(`Fretes da Frota Sincronizados! Lucro da Equipe: R$ ${totalLucroMotoristas.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`, 'success');
        } else {
            customAlert(`Fretes da Frota Sincronizados! Prejuízo na Equipe: R$ ${Math.abs(totalLucroMotoristas).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`, 'error');
        }
    }, 1500); // Mostra o alerta da frota um pouco depois do alerta do usuário
}

// Submeter Formulário
transactionForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const desc = document.getElementById('trans-desc').value;
    const value = parseFloat(document.getElementById('trans-value').value);
    let type = typeInput.value;
    
    const categoryEl = document.getElementById('trans-category');
    if (categoryEl && categoryEl.parentElement.style.display !== 'none' && type === 'despesa') {
        if (categoryEl.value === 'bonus') {
            type = 'receita';
        }
    }

    if (isNaN(value) || value <= 0) {
        customAlert("Digite um valor válido maior que zero!");
        return;
    }

    // Criar registro da transação
    const transacao = {
        id: Date.now(),
        data: new Date().toLocaleDateString('pt-BR'),
        descricao: desc,
        valor: value,
        tipo: type
    };

    appState.transacoes.push(transacao);

    // Atualizar saldos
    if (type === 'receita') {
        appState.saldo += value;
        appState.lucroSemanal += value;
        customAlert(`Receita/Bônus registrado com sucesso!`, 'success');
        
        // Se for realmente um frete (type original era receita) e não um bônus, gera os fretes automáticos
        if (typeInput.value === 'receita') {
            gerarFretesAutomaticosParaMotoristas();
        }
    } else {
        appState.saldo -= value;
        appState.despesasSemanal += value;
        customAlert(`Despesa registrada com sucesso!`, 'success');
    }

    saveState();
    updateDashboard();
    closeModal('transaction-modal');
});

// Comprar Reboque Form
document.getElementById('trailer-form').addEventListener('submit', (e) => {
    e.preventDefault();
    if(!appState.reboques) appState.reboques = [];
    
    const modelo = document.getElementById('trailer-model-input').value.trim();
    const valor = parseFloat(document.getElementById('trailer-price').value);
    const garageSelected = document.getElementById('trailer-garage').value;
    const caminhaoId = document.getElementById('trailer-truck') ? document.getElementById('trailer-truck').value : '';

    if (isNaN(valor) || valor <= 0 || !modelo) {
        customAlert("Preencha o tipo e informe um valor válido para o reboque!", "error");
        return;
    }

    const garagemDestino = appState.garagens.find(g => g.cidade === garageSelected);
    const reboquesNaGaragem = appState.reboques.filter(r => r.cidade === garageSelected).length;

    if (!garagemDestino) {
        customAlert("Selecione uma garagem válida!", "error");
        return;
    }

    if (reboquesNaGaragem >= garagemDestino.capacidade) {
        customAlert(`Sem vagas na garagem de ${garageSelected}! Capacidade máxima (${garagemDestino.capacidade}) atingida.`, "error");
        return;
    }

    if (valor > appState.saldo) {
        customAlert(`Saldo insuficiente! Custa R$ ${valor.toLocaleString('pt-BR')}. Vá ao banco.`, 'error');
        return;
    }

    appState.saldo -= valor;
    
    if (caminhaoId !== '') {
        appState.reboques.forEach(r => {
            if (String(r.caminhaoId) === String(caminhaoId)) {
                r.caminhaoId = null;
            }
        });
    }

    appState.reboques.push({
        id: Date.now(),
        modelo: modelo,
        cidade: garageSelected,
        caminhaoId: caminhaoId !== '' ? String(caminhaoId) : null,
        data: new Date().toLocaleDateString('pt-BR')
    });

    appState.transacoes.push({
        id: Date.now(),
        data: new Date().toLocaleDateString('pt-BR'),
        descricao: `Compra de Reboque: ${modelo}`,
        valor: valor,
        tipo: 'despesa'
    });

    customAlert(`Reboque ${modelo} adquirido com sucesso!`, 'success');
    saveState();
    updateDashboard();
    closeModal('trailer-modal');
});

// Contratar Motorista Form
document.getElementById('driver-form').addEventListener('submit', (e) => {
    e.preventDefault();
    if(!appState.funcionarios) appState.funcionarios = [];
    
    // Função para formatar o nome em Title Case (Primeira letra maiúscula)
    const formatName = (str) => {
        const preposicoes = ["da", "de", "do", "das", "dos", "e"];
        return str.toLowerCase().split(' ').map((word, index) => {
            if (index !== 0 && preposicoes.includes(word)) return word;
            return word.charAt(0).toUpperCase() + word.slice(1);
        }).join(' ').trim();
    };

    const nome = formatName(document.getElementById('driver-name').value);
    const cidade = document.getElementById('driver-city').value;
    const taxa = parseFloat(document.getElementById('driver-salary').value);

    // Verificar se já existe (ignorando espaços extras)
    const nameToCheck = nome.trim().toLowerCase().replace(/\s+/g, ' ');
    const exists = appState.funcionarios.find(f => {
        const empName = f.nome ? f.nome.trim().toLowerCase().replace(/\s+/g, ' ') : '';
        return empName === nameToCheck;
    });
    
    if (exists) {
        customAlert(`O motorista ${nome} já faz parte do quadro de funcionários!`, 'error');
        document.getElementById('driver-name').value = '';
        return;
    }

    if (isNaN(taxa) || taxa < 0) {
        customAlert("Digite um valor válido!", 'error');
        return;
    }

    const targetCity = cidade.trim();
    const garagemDestino = appState.garagens.find(g => g.cidade.trim().toLowerCase() === targetCity.toLowerCase());

    if (!garagemDestino) {
        customAlert(`Garagem inexistente na cidade: ${targetCity}. Compre uma lá ou renomeie a Sede!`, 'error');
        return;
    }

    // O proprietário (Dono) sempre ocupa 1 vaga na Matriz (Garagem 0)
    let motoristasNaCidade = appState.funcionarios.filter(f => {
        const match = f.cargo.match(/\((.*?)\)/);
        if (match) {
            return match[1].trim().toLowerCase() === targetCity.toLowerCase();
        }
        return false;
    }).length;

    if (appState.garagens[0] && targetCity.toLowerCase() === appState.garagens[0].cidade.trim().toLowerCase()) {
        motoristasNaCidade += 1;
    }

    if (motoristasNaCidade >= garagemDestino.capacidade) {
        customAlert(`Sem vagas na garagem de ${targetCity}! Capacidade máxima (${garagemDestino.capacidade}) atingida.`, "error");
        return;
    }

    if (taxa > appState.saldo) {
        customAlert("Saldo insuficiente para pagar contratacao!", 'error');
        return;
    }

    appState.saldo -= taxa;
    const novoMotoristaId = Date.now();
    appState.funcionarios.push({
        id: novoMotoristaId,
        nome: nome,
        cargo: `Motorista (${cidade})`,
        salario: taxa
    });

    const assignTruckId = document.getElementById('driver-truck') ? document.getElementById('driver-truck').value : '';
    if (assignTruckId !== '' && appState.caminhoes) {
        const trIndex = appState.caminhoes.findIndex(c => String(c.id) === String(assignTruckId));
        if (trIndex !== -1) {
            appState.caminhoes[trIndex].motoristaId = String(novoMotoristaId);
        }
    }

    if (taxa > 0) {
        appState.transacoes.push({
            id: Date.now(),
            data: new Date().toLocaleDateString('pt-BR'),
            descricao: `Contratação de Motorista: ${nome}`,
            valor: taxa,
            tipo: 'despesa'
        });
    }

    customAlert(`Motorista ${nome} contratado com sucesso!`, 'success');
    saveState();
    updateDashboard();
    closeModal('driver-modal');
});

// Verificação em tempo real (on blur) para o campo de nome
document.getElementById('driver-name').addEventListener('blur', (e) => {
    if(!appState.funcionarios || !e.target.value) return;
    const nameToCheck = e.target.value.trim().toLowerCase().replace(/\s+/g, ' ');
    const exists = appState.funcionarios.find(f => {
        const empName = f.nome ? f.nome.trim().toLowerCase().replace(/\s+/g, ' ') : '';
        return empName === nameToCheck;
    });
    if (exists) {
        customAlert(`Atenção: ${e.target.value} já está na equipe!`, 'error');
        e.target.value = '';
    }
});

// Demitir Motorista
window.demitirMotorista = function(id) {
    const ind = appState.funcionarios.findIndex(f => String(f.id) === String(id));
    if (ind !== -1) {
        const func = appState.funcionarios[ind];
        if (confirm(`Tem certeza que deseja demitir o motorista ${func.nome}?`)) {
            
            // Reembolsar o valor da contratação (rescisão devolve o custo da taxa)
            let valorRestituido = func.salario || 0;
            const transc = appState.transacoes.find(t => t.descricao === `Contratação de Motorista: ${func.nome}`);
            if (transc && transc.valor) {
                valorRestituido = transc.valor;
            }
            
            appState.saldo += valorRestituido;
            
            if (valorRestituido > 0) {
                appState.transacoes.push({
                    id: Date.now(),
                    data: new Date().toLocaleDateString('pt-BR'),
                    descricao: `Restituição de Contrato: ${func.nome}`,
                    valor: valorRestituido,
                    tipo: 'receita'
                });
            }

            if (appState.caminhoes) {
                const idxCam = appState.caminhoes.findIndex(c => String(c.motoristaId) === String(id));
                if(idxCam !== -1) appState.caminhoes[idxCam].motoristaId = null;
            }

            customAlert(`Motorista ${func.nome} foi demitido. Restituição de R$ ${valorRestituido.toLocaleString('pt-BR')} adicionada.`, 'success');
            appState.funcionarios.splice(ind, 1);
            saveState();
            updateDashboard();
        }
    }
};

document.getElementById('link-equipment-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const sourceId = document.getElementById('link-source-id').value;
    const sourceType = document.getElementById('link-source-type').value;
    const targetId = document.getElementById('link-target-select').value;
    
    if (sourceType === 'truck') {
        // targetId é um trailerId
        
        // Desatrelar qualquer reboque que ESTE caminhão já tenha
        if (appState.reboques) {
            appState.reboques.forEach(r => {
                if(String(r.caminhaoId) === String(sourceId)) r.caminhaoId = null;
            });
        }
        
        // Se escolheu um novo reboque
        if (targetId && appState.reboques) {
            const tr = appState.reboques.find(r => String(r.id) === String(targetId));
            if (tr) tr.caminhaoId = String(sourceId);
        }
        
    } else if (sourceType === 'trailer') {
        // targetId é um truckId
        
        // Primeiro desatrelar este reboque de qualquer lugar
        if (appState.reboques) {
            const thisTr = appState.reboques.find(r => String(r.id) === String(sourceId));
            if (thisTr) thisTr.caminhaoId = null;
            
            // Agora atrelar ao caminhão alvo, se houver
            if (targetId) {
                // Remove qualquer outro reboque do caminhão alvo
                appState.reboques.forEach(r => {
                    if (String(r.caminhaoId) === String(targetId)) r.caminhaoId = null;
                });
                
                // Atrela
                if (thisTr) thisTr.caminhaoId = String(targetId);
            }
        }
    }
    
    customAlert("Equipamento engatado com sucesso!", "success");
    saveState();
    updateDashboard();
    closeModal('link-equipment-modal');
});

document.getElementById('assign-truck-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('assign-driver-id').value;
    const truckId = document.getElementById('assign-truck-select').value;
    const trailerId = document.getElementById('assign-trailer-select').value;
    
    // Primeiro limpamos o motorista de qualquer caminhão que ele já tenha
    let oldTruckId = null;
    if (appState.caminhoes) {
        appState.caminhoes.forEach(c => {
            if (String(c.motoristaId) === String(id)) {
                oldTruckId = c.id;
                c.motoristaId = null;
            }
        });
    }

    // Se selecionou um caminhão novo, atrelamos
    if (truckId && appState.caminhoes) {
        const trIndex = appState.caminhoes.findIndex(c => String(c.id) === String(truckId));
        if (trIndex !== -1) {
            appState.caminhoes[trIndex].motoristaId = String(id);
        }
    }

    if (appState.reboques) {
        // Se escolheu um reboque, desatrela ele de onde estiver
        if (trailerId) {
            const trTarget = appState.reboques.find(r => String(r.id) === String(trailerId));
            if (trTarget) trTarget.caminhaoId = null;
        }

        // Se há um caminhão agora com esse motorista, removemos o reboque do caminhão primeiro e adicionamos o novo
        if (truckId) {
            appState.reboques.forEach(r => {
                if (String(r.caminhaoId) === String(truckId)) r.caminhaoId = null;
            });
            if (trailerId) {
                const tr = appState.reboques.find(r => String(r.id) === String(trailerId));
                if (tr) tr.caminhaoId = String(truckId);
            }
        } else if (!truckId && oldTruckId && !trailerId) {
            // Se ele removeu o caminhão, então o reboque que estava nele perde o caminhão se optou por remover? 
            // O usuário também enviou trailerId vazio, então desatrelamos do oldTruckId caso ele queira esvaziar tudo
            appState.reboques.forEach(r => {
                if (String(r.caminhaoId) === String(oldTruckId)) r.caminhaoId = null;
            });
        }
    }

    customAlert("Equipamentos atualizados!", "success");

    saveState();
    updateDashboard();
    closeModal('assign-truck-modal');
});

function openTransferModal(id, type, name, currentCity) {
    document.getElementById('transfer-item-id').value = id;
    document.getElementById('transfer-item-type').value = type;
    
    let typeName = type === 'motorista' ? 'o motorista' : (type === 'caminhao' ? 'o caminhão' : 'o reboque');
    document.getElementById('transfer-modal-desc').innerText = `Transferindo ${typeName} ${name}\nLocal Atual: ${currentCity || 'Nenhum'}`;
    document.getElementById('transfer-garage').value = '';
    
    const datalist = document.getElementById('transfer-garages-list');
    if(datalist) {
        datalist.innerHTML = '';
        if(appState.garagens) {
            appState.garagens.forEach(g => {
                datalist.innerHTML += `<option value="${g.cidade}">`;
            });
        }
    }
    
    document.getElementById('transfer-modal').classList.remove('hidden');
}

window.transferirMotorista = function(id) {
    const ind = appState.funcionarios.findIndex(f => String(f.id) === String(id));
    if (ind !== -1) {
        const atual = appState.funcionarios[ind].cargo.replace('Motorista (', '').replace(')', '');
        openTransferModal(id, 'motorista', appState.funcionarios[ind].nome, atual);
    }
};

window.transferirCaminhao = function(id) {
    const ind = appState.caminhoes.findIndex(c => String(c.id) === String(id));
    if (ind !== -1) {
        openTransferModal(id, 'caminhao', appState.caminhoes[ind].modelo, appState.caminhoes[ind].cidade);
    }
};

window.transferirReboque = function(id) {
    const ind = appState.reboques.findIndex(r => String(r.id) === String(id));
    if (ind !== -1) {
        openTransferModal(id, 'reboque', appState.reboques[ind].modelo, appState.reboques[ind].cidade);
    }
};

document.getElementById('transfer-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('transfer-item-id').value;
    const type = document.getElementById('transfer-item-type').value;
    const nova = document.getElementById('transfer-garage').value;
    
    if (nova && nova.trim() !== '') {
        const cidadeDestino = nova.trim();
        const garagemDestino = appState.garagens.find(g => g.cidade.trim().toLowerCase() === cidadeDestino.toLowerCase());
        
        if (garagemDestino) {
            let limitReached = false;
            let successMsg = "";
            
            if (type === 'motorista') {
                const ind = appState.funcionarios.findIndex(f => String(f.id) === String(id));
                let ocupados = appState.funcionarios.filter(f => {
                    const match = f.cargo.match(/\((.*?)\)/);
                    return match && match[1].trim().toLowerCase() === cidadeDestino.toLowerCase();
                }).length;
                
                // O proprietário (Dono) sempre ocupa 1 vaga na Matriz (Garagem 0)
                if (appState.garagens[0] && cidadeDestino.toLowerCase() === appState.garagens[0].cidade.trim().toLowerCase()) {
                    ocupados += 1;
                }
                
                if (ocupados >= garagemDestino.capacidade) limitReached = true;
                else {
                    appState.funcionarios[ind].cargo = `Motorista (${garagemDestino.cidade})`;
                    if (appState.caminhoes) {
                        const idxCam = appState.caminhoes.findIndex(c => String(c.motoristaId) === String(id));
                        if(idxCam !== -1) appState.caminhoes[idxCam].motoristaId = null;
                    }
                    successMsg = "Motorista transferido com sucesso!";
                }
            } else if (type === 'caminhao') {
                const ind = appState.caminhoes.findIndex(c => String(c.id) === String(id));
                const ocupados = appState.caminhoes.filter(c => c.cidade && c.cidade.trim().toLowerCase() === cidadeDestino.toLowerCase()).length;
                if (ocupados >= garagemDestino.capacidade) limitReached = true;
                else {
                    appState.caminhoes[ind].cidade = garagemDestino.cidade;
                    appState.caminhoes[ind].motoristaId = null;
                    if (appState.reboques) {
                         appState.reboques.forEach(r => { 
                             if(String(r.caminhaoId) === String(id)) r.caminhaoId = null; 
                         });
                    }
                    successMsg = "Caminhão transferido com sucesso!";
                }
            } else if (type === 'reboque') {
                const ind = appState.reboques.findIndex(r => String(r.id) === String(id));
                const ocupados = appState.reboques.filter(r => r.cidade && r.cidade.trim().toLowerCase() === cidadeDestino.toLowerCase()).length;
                if (ocupados >= garagemDestino.capacidade) limitReached = true;
                else {
                    appState.reboques[ind].cidade = garagemDestino.cidade;
                    appState.reboques[ind].caminhaoId = null;
                    successMsg = "Reboque transferido com sucesso!";
                }
            }
            
            if (limitReached) {
                customAlert(`Sem vagas na garagem de ${cidadeDestino}! Capacidade máxima (${garagemDestino.capacidade}) atingida.`, "error");
            } else {
                saveState();
                updateDashboard();
                closeModal('transfer-modal');
                customAlert(successMsg, "success");
            }
        } else {
            customAlert(`Garagem inexistente na cidade: ${cidadeDestino}`, "error");
        }
    }
});

window.ajustarEstatistica = function(tipo) {
    let atual = tipo === 'lucro' ? appState.lucroSemanal : appState.despesasSemanal;
    const nome = tipo === 'lucro' ? 'Lucro Semanal' : 'Despesas da Semana';
    
    const msg = `${nome} atual: R$ ${atual.toFixed(2)}\n\nComo você quer ajustar?\n- Para subtrair (abater) digite um menos antes (Ex: -147)\n- Para somar digite um mais antes (Ex: +147)\n- Para definir um valor exato ou zerar, só digite o número (Ex: 0)`;
    
    customPromptNumber(`Ajustar ${nome}`, msg, "", (input) => {
        if (input !== null && input.trim() !== "") {
            const valStr = input.trim().replace(',', '.');
            const isCalculo = valStr.startsWith('+') || valStr.startsWith('-');
            const val = parseFloat(valStr);
            
            if (!isNaN(val)) {
                let novoValor = atual;
                if (isCalculo) {
                    novoValor = atual + val; 
                } else {
                    novoValor = Math.abs(val); // Define valor exato
                }
                
                if (novoValor < 0) novoValor = 0; // Nao deixa ficar negativo
                
                if (tipo === 'lucro') {
                    appState.lucroSemanal = novoValor;
                } else {
                    appState.despesasSemanal = novoValor;
                }
                saveState();
                updateDashboard();
                customAlert(`${nome} atualizado para R$ ${novoValor.toFixed(2)}`, "success");
            } else {
                customAlert("Valor inválido. Tente novamente.", "error");
            }
        }
    });
};

window.editarTransacao = function(id) {
    const ind = appState.transacoes.findIndex(t => String(t.id) === String(id));
    if (ind !== -1) {
        const t = appState.transacoes[ind];
        customPromptNumber(`Corrigir Valor`, `Corrigir valor para: ${t.descricao}\n(Apenas números)`, t.valor, (novoValorStr) => {
            if (novoValorStr !== null) {
                const nv = parseFloat(novoValorStr.replace(',', '.'));
                if (isNaN(nv) || nv < 0) {
                    customAlert("Valor inválido.");
                    return;
                }
                const diff = nv - t.valor;
                if (diff === 0) return;
    
                if (t.tipo === 'receita') {
                    appState.saldo += diff;
                    if (!t.descricao.includes('Empréstimo') && !t.descricao.startsWith('Venda') && !t.descricao.startsWith('Trabalho:')) {
                        appState.lucroSemanal += diff;
                    }
                    if (t.descricao === 'Empréstimo Bancário') {
                        appState.dividaBancaria += diff;
                    }
                } else {
                    appState.saldo -= diff;
                    if (!t.descricao.includes('Empréstimo') && !t.descricao.startsWith('Compra') && !t.descricao.startsWith('Imobiliária') && !t.descricao.startsWith('Contratação') && !t.descricao.startsWith('Trabalho:')) {
                        appState.despesasSemanal += diff;
                    }
                    if (t.descricao === 'Pagamento de Empréstimo') {
                        appState.dividaBancaria -= diff;
                    }
                }
                appState.transacoes[ind].valor = nv;
    
                // Sync se for contratação de motorista
                if (t.descricao.startsWith('Contratação de Motorista: ')) {
                    const name = t.descricao.replace('Contratação de Motorista: ', '').trim();
                    const workerIndex = appState.funcionarios.findIndex(f => f.nome === name);
                    if (workerIndex !== -1) {
                        appState.funcionarios[workerIndex].salario = nv;
                    }
                }
    
                customAlert("Valor corrigido com sucesso!", "success");
                saveState();
                updateDashboard();
            }
        });
    }
};

window.venderCaminhao = function(id) {
    const ind = appState.caminhoes.findIndex(c => String(c.id) === String(id));
    if (ind !== -1) {
        customPromptNumber(`Vender Caminhão`, `Por quanto dinheiro você vendeu o caminhão ${appState.caminhoes[ind].modelo} no jogo? (Apenas números, ou 0)`, "100000", (valor) => {
            if (valor !== null) {
                const v = parseFloat(valor);
                if (isNaN(v) || v < 0) {
                    customAlert("Valor inválido.");
                    return;
                }
                appState.saldo += v;
                appState.transacoes.push({
                    id: Date.now(),
                    data: new Date().toLocaleDateString('pt-BR'),
                    descricao: `Venda de Caminhão: ${appState.caminhoes[ind].modelo}`,
                    valor: v,
                    tipo: 'receita'
                });
                if (appState.reboques) {
                     appState.reboques.forEach(r => { 
                         if(String(r.caminhaoId) === String(id)) r.caminhaoId = null; 
                     });
                }
                appState.caminhoes.splice(ind, 1);
                customAlert("Caminhão vendido!", "success");
                saveState();
                updateDashboard();
            }
        });
    }
};

window.venderReboque = function(id) {
    const ind = appState.reboques.findIndex(r => String(r.id) === String(id));
    if (ind !== -1) {
        customPromptNumber(`Vender Reboque`, `Por quanto dinheiro você vendeu o reboque ${appState.reboques[ind].modelo} no jogo? (Apenas números, ou 0)`, "30000", (valor) => {
            if (valor !== null) {
                const v = parseFloat(valor);
                if (isNaN(v) || v < 0) {
                    customAlert("Valor inválido.");
                    return;
                }
                appState.saldo += v;
                appState.transacoes.push({
                    id: Date.now(),
                    data: new Date().toLocaleDateString('pt-BR'),
                    descricao: `Venda de Reboque: ${appState.reboques[ind].modelo}`,
                    valor: v,
                    tipo: 'receita'
                });
                appState.reboques.splice(ind, 1);
                customAlert("Reboque vendido!", "success");
                saveState();
                updateDashboard();
            }
        });
    }
};

window.venderGaragem = function(id) {
    if (String(id) === "1" || (appState.garagens[0] && String(appState.garagens[0].id) === String(id))) {
        customAlert("Você não pode vender a Sua Base Principal (Sede)!", "error");
        return;
    }
    const ind = appState.garagens.findIndex(g => String(g.id) === String(id));
    if (ind !== -1) {
        customPromptNumber(`Vender Garagem`, `Por quanto você vendeu a garagem em ${appState.garagens[ind].cidade} no jogo? (Apenas números)`, "180000", (valor) => {
            if (valor !== null) {
                const v = parseFloat(valor);
                if (isNaN(v) || v < 0) {
                    customAlert("Valor inválido.");
                    return;
                }
                appState.saldo += v;
                appState.transacoes.push({
                    id: Date.now(),
                    data: new Date().toLocaleDateString('pt-BR'),
                    descricao: `Venda de Garagem: ${appState.garagens[ind].cidade}`,
                    valor: v,
                    tipo: 'receita'
                });
                appState.garagens.splice(ind, 1);
                customAlert("Garagem vendida!", "success");
                saveState();
                updateDashboard();
            }
        });
    }
};

window.repararCaminhao = function(id) {
    const ind = appState.caminhoes.findIndex(c => String(c.id) === String(id));
    if (ind !== -1) {
        customPromptNumber(`Manutenção do Caminhão`, `Qual o valor da manutenção (reparo de danos) para o ${appState.caminhoes[ind].modelo}?`, "5000", (valor) => {
            if (valor !== null) {
                const v = parseFloat(valor);
                if (isNaN(v) || v <= 0) {
                    customAlert("Valor inválido.");
                    return;
                }
                if (v > appState.saldo) {
                    customAlert("Saldo insuficiente para pagar esta manutenção!", "error");
                    return;
                }
                appState.saldo -= v;
                appState.transacoes.push({
                    id: Date.now(),
                    data: new Date().toLocaleDateString('pt-BR'),
                    descricao: `Manutenção de Caminhão: ${appState.caminhoes[ind].modelo}`,
                    valor: v,
                    tipo: 'despesa'
                });
                customAlert("Manutenção realizada com sucesso!", "success");
                saveState();
                updateDashboard();
            }
        });
    }
};

window.repararReboque = function(id) {
    const ind = appState.reboques.findIndex(r => String(r.id) === String(id));
    if (ind !== -1) {
        customPromptNumber(`Manutenção do Reboque`, `Qual o valor da manutenção (reparo de danos) para o reboque ${appState.reboques[ind].modelo}?`, "3000", (valor) => {
            if (valor !== null) {
                const v = parseFloat(valor);
                if (isNaN(v) || v <= 0) {
                    customAlert("Valor inválido.");
                    return;
                }
                if (v > appState.saldo) {
                    customAlert("Saldo insuficiente para pagar esta manutenção!", "error");
                    return;
                }
                appState.saldo -= v;
                appState.transacoes.push({
                    id: Date.now(),
                    data: new Date().toLocaleDateString('pt-BR'),
                    descricao: `Manutenção de Reboque: ${appState.reboques[ind].modelo}`,
                    valor: v,
                    tipo: 'despesa'
                });
                customAlert("Manutenção realizada com sucesso!", "success");
                saveState();
                updateDashboard();
            }
        });
    }
};

window.transferirCaminhao = function(id) {
    const ind = appState.caminhoes.findIndex(c => String(c.id) === String(id));
    if (ind !== -1) {
        document.getElementById('transfer-item-id').value = id;
        document.getElementById('transfer-item-type').value = 'caminhao';
        
        const list = document.getElementById('transfer-garages-list');
        list.innerHTML = '';
        if(appState.garagens) {
            appState.garagens.forEach(g => {
                list.innerHTML += `<option value="${g.cidade}">`;
            });
        }
        
        document.getElementById('transfer-garage').value = '';
        document.getElementById('transfer-modal-desc').innerText = `Transferindo caminhão: ${appState.caminhoes[ind].modelo}`;
        document.getElementById('transfer-modal').classList.remove('hidden');
    }
};

window.transferirReboque = function(id) {
    const ind = appState.reboques.findIndex(r => String(r.id) === String(id));
    if (ind !== -1) {
        document.getElementById('transfer-item-id').value = id;
        document.getElementById('transfer-item-type').value = 'reboque';
        
        const list = document.getElementById('transfer-garages-list');
        list.innerHTML = '';
        if(appState.garagens) {
            appState.garagens.forEach(g => {
                list.innerHTML += `<option value="${g.cidade}">`;
            });
        }
        
        document.getElementById('transfer-garage').value = '';
        document.getElementById('transfer-modal-desc').innerText = `Transferindo reboque: ${appState.reboques[ind].modelo}`;
        document.getElementById('transfer-modal').classList.remove('hidden');
    }
};

window.updateDriverTruckSelect = function() {
    const selectCity = document.getElementById('driver-city');
    const selectTruck = document.getElementById('driver-truck');
    if(!selectCity || !selectTruck) return;

    selectTruck.innerHTML = '<option value="">Sem Caminhão (Apenas Cadastro)</option>';

    if (appState.caminhoes) {
        const truckLivres = appState.caminhoes.filter(c => c.cidade === selectCity.value && (!c.motoristaId));
        truckLivres.forEach(c => {
            selectTruck.innerHTML += `<option value="${c.id}">${c.modelo} (${c.placa})</option>`;
        });
    }
};

window.updateTruckDriverSelect = function() {
    const selectCity = document.getElementById('truck-garage');
    const selectDriver = document.getElementById('truck-driver');
    if(!selectCity || !selectDriver) return;
    
    selectDriver.innerHTML = '<option value="">Sem Motorista</option>';
    
    if (appState.funcionarios) {
        appState.funcionarios.forEach(f => {
            const isOwner = f.cargo.includes('Proprietário');
            let driverCity = '';
            const match = f.cargo.match(/\((.*?)\)/);
            if (match) {
                driverCity = match[1].trim();
            } else if (isOwner && appState.garagens && appState.garagens.length > 0) {
                driverCity = appState.garagens[0].cidade.trim();
            }

            if (driverCity === selectCity.value.trim()) {
                const hasTruck = appState.caminhoes && appState.caminhoes.find(c => String(c.motoristaId) === String(f.id));
                let dispName = f.nome;
                if(hasTruck) dispName += ` (Ocupado: ${hasTruck.placa})`;
                else dispName += ` (Livre)`;
                selectDriver.innerHTML += `<option value="${f.id}">${dispName}</option>`;
            }
        });
    }
};

window.updateTrailerTruckSelect = function() {
    const selectCity = document.getElementById('trailer-garage');
    const selectTruck = document.getElementById('trailer-truck');
    if(!selectCity || !selectTruck) return;
    
    selectTruck.innerHTML = '<option value="">Na Garagem (Solto)</option>';
    
    if (appState.caminhoes) {
        const truckNaCidade = appState.caminhoes.filter(c => c.cidade.trim() === selectCity.value.trim());
        truckNaCidade.forEach(c => {
            const hasTrailer = appState.reboques && appState.reboques.find(r => String(r.caminhaoId) === String(c.id));
            let dispName = `${c.modelo} (${c.placa})`;
            if(hasTrailer) dispName += ` (Já possui reboque)`;
            else dispName += ` (Livre)`;
            selectTruck.innerHTML += `<option value="${c.id}">${dispName}</option>`;
        });
    }
};

// Funções para Modais de Viagem/Diária
window.openDriverTripModal = function(id, nome, salario) {
    document.getElementById('trip-driver-id').value = id;
    document.getElementById('trip-driver-name').textContent = "Motorista: " + nome;
    
    // Verifica se já teve trabalho registrado HOJE com diária paga
    const funcIndex = appState.funcionarios.findIndex(f => String(f.id) === String(id));
    let descontoDiariaSugerido = salario > 0 ? salario : 0;
    
    if (funcIndex !== -1 && appState.funcionarios[funcIndex].historico) {
        const hoje = new Date().toLocaleDateString('pt-BR');
        const jaPagouHoje = appState.funcionarios[funcIndex].historico.some(h => h.data === hoje && h.wage > 0);
        if (jaPagouHoje) {
            descontoDiariaSugerido = 0; // Já foi pago no primeiro frete de hoje, zera automático!
        }
    }
    
    document.getElementById('trip-wage').value = descontoDiariaSugerido;
    document.getElementById('driver-trip-modal').classList.remove('hidden');
};

window.openDriverWageModal = function(id, nome, salario) {
    if(salario <= 0) return; // Não ajusta diária de dono, ou diária já desativada
    document.getElementById('wage-driver-id').value = id;
    document.getElementById('wage-driver-name').textContent = "Motorista: " + nome;
    document.getElementById('new-wage').value = salario;
    document.getElementById('driver-wage-modal').classList.remove('hidden');
};

window.openDriverProfileView = function(id) {
    const funcIndex = appState.funcionarios.findIndex(f => String(f.id) === String(id));
    if (funcIndex !== -1) {
        const func = appState.funcionarios[funcIndex];
        document.getElementById('report-driver-name').textContent = func.nome;
        
        let totalRev = 0;
        let totalExp = 0;
        let totalProfit = 0;
        
        const listEl = document.getElementById('driver-report-list');
        listEl.innerHTML = '';
        
        const formatBRL = (value) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        
        if (func.historico && func.historico.length > 0) {
            [...func.historico].reverse().forEach(h => {
                totalRev += h.receita;
                totalExp += (h.despesa + h.wage);
                totalProfit += h.lucroFinal;
                
                listEl.innerHTML += `
                <div class="list-item" style="border-left: 3px solid ${h.lucroFinal >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'};">
                    <div style="flex-grow: 1; min-width: 0;">
                        <div class="item-title" style="font-size: 0.95rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"><i class="fa fa-box" style="color: var(--text-secondary); margin-right: 5px;"></i> ${h.descricao || 'Trabalho'}</div>
                        <div class="item-subtitle" style="font-size: 0.8rem; margin-top: 4px;">${h.data}</div>
                    </div>
                    <div style="text-align: right; padding-left: 10px; flex-shrink: 0;">
                        <div style="font-weight: 800; font-size: 1.1rem; color: ${h.lucroFinal >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'}">
                            ${h.lucroFinal >= 0 ? '+' : ''}${formatBRL(h.lucroFinal)}
                        </div>
                    </div>
                </div>`;
            });
        } else {
            listEl.innerHTML = '<p style="color: var(--text-secondary); text-align: center; margin-top: 20px;">Nenhuma viagem ou frete registrado nesta semana.</p>';
        }
        
        document.getElementById('report-revenue').textContent = formatBRL(totalRev);
        document.getElementById('report-expense').textContent = formatBRL(totalExp);
        document.getElementById('report-profit').textContent = formatBRL(totalProfit);
        
        // Esconder botão de nova viagem para as IA (já que é automático)
        const btnNovaViagem = document.getElementById('btn-nova-viagem-motorista');
        if (btnNovaViagem) {
            btnNovaViagem.style.display = 'none';
        }
        
        // Altera View Ativa
        document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));
        document.getElementById('view-motorista-relatorio').classList.add('active');
    }
};

document.getElementById('driver-trip-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('trip-driver-id').value;
    const desc = document.getElementById('trip-desc').value || "Trabalho";
    const receita = parseFloat(document.getElementById('trip-revenue').value) || 0;
    const despesa = parseFloat(document.getElementById('trip-expense').value) || 0;
    let wageInput = parseFloat(document.getElementById('trip-wage').value);
    
    if (isNaN(wageInput) || wageInput < 0) wageInput = 0;
    
    const funcIndex = appState.funcionarios.findIndex(f => String(f.id) === String(id));
    if(funcIndex !== -1) {
        const func = appState.funcionarios[funcIndex];
        let wage = wageInput;
        
        const lucroFinal = receita - despesa - wage;
        
        appState.saldo += lucroFinal;
        appState.lucroSemanal += receita;
        appState.despesasSemanal += (despesa + wage);
        
        appState.transacoes.push({
            id: Date.now(),
            data: new Date().toLocaleDateString('pt-BR'),
            descricao: `Trabalho: ${func.nome} (${desc})`,
            valor: Math.abs(lucroFinal),
            tipo: lucroFinal >= 0 ? 'receita' : 'despesa'
        });
        
        if(!func.historico) func.historico = [];
        func.historico.push({
            id: Date.now(),
            data: new Date().toLocaleDateString('pt-BR'),
            descricao: desc,
            receita: receita,
            despesa: despesa,
            wage: wage,
            lucroFinal: lucroFinal
        });
        
        customAlert(`Registro de ${func.nome} salvo! Lucro: R$ ${lucroFinal.toFixed(2)}`, lucroFinal >= 0 ? 'success' : 'error');
        saveState();
        updateDashboard();
        closeModal('driver-trip-modal');
        
        // Recarregar perfil do motorista na tela
        openDriverProfileView(func.id);
    }
});

window.deleteDriverTrip = function(motoristaId, tripId) {
    if(!confirm("Tem certeza que deseja excluir as finanças deste trabalho e devolvê-las ao banco?")) return;
    
    const funcIndex = appState.funcionarios.findIndex(f => String(f.id) === String(motoristaId));
    if(funcIndex === -1) return;
    
    const func = appState.funcionarios[funcIndex];
    if(!func.historico) return;
    
    const histIndex = func.historico.findIndex(h => String(h.id) === String(tripId));
    if(histIndex === -1) return;
    
    const h = func.historico[histIndex];
    
    // Reverter as transações no appState e no Extrato
    appState.saldo -= h.lucroFinal; 
    appState.lucroSemanal -= h.receita;
    appState.despesasSemanal -= (h.despesa + h.wage);
    
    if(appState.lucroSemanal < 0) appState.lucroSemanal = 0;
    if(appState.despesasSemanal < 0) appState.despesasSemanal = 0;
    
    // Deletar a transação principal correspondente (criada no mesmo timestamp)
    const tIndex = appState.transacoes.findIndex(t => String(t.id) === String(tripId));
    if (tIndex !== -1) {
        appState.transacoes.splice(tIndex, 1);
    }
    
    // Remover do histórico
    func.historico.splice(histIndex, 1);
    
    customAlert("Trabalho excluído e valores revertidos!", "success");
    saveState();
    updateDashboard();
    
    // Atualizar tela em tempo real
    openDriverProfileView(motoristaId);
};

document.getElementById('driver-wage-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('wage-driver-id').value;
    const value = parseFloat(document.getElementById('new-wage').value);
    
    if(isNaN(value) || value < 0) {
        customAlert("Valor inválido!", "error");
        return;
    }
    
    const funcIndex = appState.funcionarios.findIndex(f => String(f.id) === String(id));
    if(funcIndex !== -1) {
        const func = appState.funcionarios[funcIndex];
        
        // Sync de volta para o registro de contratação caso exista
        const hiringDesc = `Contratação de Motorista: ${func.nome}`;
        const transIndex = appState.transacoes.findIndex(t => t.descricao === hiringDesc);
        if (transIndex !== -1) {
            const diff = value - appState.transacoes[transIndex].valor;
            if (diff !== 0) {
                appState.saldo -= diff; // Contratação é despesa, se valor aumentou, saldo diminui
                appState.transacoes[transIndex].valor = value;
            }
        }
        
        func.salario = value;
        customAlert(`Nova diária de ${func.nome} definida para R$ ${value.toFixed(2)}.`, 'success');
        saveState();
        updateDashboard();
        closeModal('driver-wage-modal');
    }
});

// Função para exibir pinpoints no mapa
function renderMapMarkers() {
    const container = document.getElementById('map-container');
    if (!container) return;
    
    // Remover markers antigos
    document.querySelectorAll('.map-marker-pin').forEach(m => m.remove());

    if (!appState.mapMarkers) appState.mapMarkers = [];
    appState.mapMarkers.forEach((marker, index) => {
        const pin = document.createElement('div');
        pin.className = 'map-marker-pin';
        const markerName = marker.name || 'Garagem';
        pin.innerHTML = `<i class="fa fa-map-marker-alt"></i><div class="marker-label">${markerName}</div>`;
        pin.style.position = 'absolute';
        pin.style.left = marker.x + '%';
        pin.style.top = marker.y + '%';
        pin.style.color = 'var(--accent-red)';
        pin.style.fontSize = '1.5rem';
        pin.style.transform = 'translate(-50%, -100%)';
        pin.style.textShadow = '0px 0px 5px rgba(0,0,0,0.8)';
        pin.style.cursor = 'pointer';
        pin.style.zIndex = '5';
        
        pin.onclick = (e) => {
            e.stopPropagation();
            
            const isSelected = pin.classList.contains('active-marker');
            const hasHover = window.matchMedia("(hover: hover)").matches;
            
            document.querySelectorAll('.map-marker-pin').forEach(m => {
                if (m !== pin) {
                    m.classList.remove('active-marker');
                    if (m._hideTimeout) clearTimeout(m._hideTimeout);
                }
            });
            
            if (!hasHover && !isSelected) {
                // 1º toque no celular apenas ativa (mostra label)
                pin.classList.add('active-marker');
                
                // Apaga sozinho depois de 3.5 segundos para não poluir a tela
                if (pin._hideTimeout) clearTimeout(pin._hideTimeout);
                pin._hideTimeout = setTimeout(() => {
                    pin.classList.remove('active-marker');
                }, 3500);

            } else {
                // PC (com mouse) ou 2º toque no celular pede para remover
                let desc = marker.name ? marker.name : "esta cidade";
                if (confirm("Remover marcação de " + desc + "?")) {
                    appState.mapMarkers.splice(index, 1);
                    saveState();
                    renderMapMarkers();
                }
            }
        };

        container.appendChild(pin);
    });
}

// Map Click para adicionar marcador
const mapImg = document.getElementById('eaa-map-img');
if (mapImg) {
    mapImg.parentElement.style.position = 'relative'; // Garantir que os filhos absolute fiquem relativos a ele
    
    mapImg.addEventListener('click', (e) => {
        // Se clicar no mapa e tiver algum balão ativo, primeiro fecha os balões.
        const actives = document.querySelectorAll('.map-marker-pin.active-marker');
        if (actives.length > 0) {
            actives.forEach(m => {
                m.classList.remove('active-marker');
                if (m._hideTimeout) clearTimeout(m._hideTimeout);
            });
            return;
        }

        // Se estava arrastando o mapa para ver e não clicou de propósito, não cria marcador.
        if (window._wasDraggingMap) {
            window._wasDraggingMap = false; // reseta
            return;
        }

        const rect = mapImg.getBoundingClientRect();
        
        // Posição no clique em relação ao elemento visível final real (considerando o zoom atual)
        const xPercent = ((e.clientX - rect.left) / rect.width) * 100;
        const yPercent = ((e.clientY - rect.top) / rect.height) * 100;

        customPromptText("Nova Marcação", "Digite o nome da garagem (ex: Filial 04 Porto Seguro):", "", (nome) => {
            if (nome) {
                if (!appState.mapMarkers) appState.mapMarkers = [];
                appState.mapMarkers.push({
                    id: Date.now(),
                    x: xPercent,
                    y: yPercent,
                    name: nome
                });
                saveState();
                renderMapMarkers();
            }
        });
    });
}

function renderInventario() {
    const list = document.getElementById('inventory-list');
    if (!list) return;
    list.innerHTML = '';
    
    if (!appState.inventarioAnual || appState.inventarioAnual.length === 0) {
        list.innerHTML = '<p style="color: var(--text-secondary);">Nenhum fechamento de semana registrado.</p>';
        return;
    }

    const formatBRL = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    // --- RESUMO ANUAL (Geral de todos os dados do inventário) ---
    let totalLucroAno = 0;
    let totalDespesaAno = 0;
    
    appState.inventarioAnual.forEach(mes => {
        mes.semanas.forEach(sem => {
            totalLucroAno += sem.lucro;
            totalDespesaAno += sem.despesa;
        });
    });
    
    const saldoAno = totalLucroAno - totalDespesaAno;
    const corSaldoAno = saldoAno >= 0 ? "var(--accent-green)" : "var(--accent-red)";

    list.innerHTML += `
    <div class="card premium-card" style="margin-bottom: 2rem; padding: 1.5rem; border: 1px solid rgba(0, 168, 255, 0.3);">
        <h3 style="margin-bottom: 1rem; text-align: center; color: white; text-transform: uppercase; letter-spacing: 2px;"><i class="fa fa-chart-pie" style="color: var(--accent-blue);"></i> Balanço Geral Anual</h3>
        <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
            <span style="color: var(--text-secondary);">Total Arrecadado:</span>
            <span style="color: var(--accent-green); font-weight: bold;">+ ${formatBRL(totalLucroAno)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 1rem;">
            <span style="color: var(--text-secondary);">Total Gasto:</span>
            <span style="color: var(--accent-red); font-weight: bold;">- ${formatBRL(totalDespesaAno)}</span>
        </div>
        <div style="text-align: center;">
            <span style="color: var(--text-secondary); display: block; font-size: 0.9rem; margin-bottom: 5px;">Lucro Líquido do Ano</span>
            <span style="font-size: 1.8rem; font-weight: 900; color: ${corSaldoAno};">${formatBRL(saldoAno)}</span>
        </div>
    </div>`;

    // --- CARDS MENSAIS ---
    // Clonar e inverter para mostrar do mais recente para o mais antigo sem alterar o array original
    [...appState.inventarioAnual].reverse().forEach(mesData => {
        let semanasHtml = '';
        let totalLucroMes = 0;
        let totalDespesaMes = 0;

        // Função local auxiliar para pegar a data correspondente da semana no mês
        const getWeekDateRange = (mesStr, semNome) => {
            const months = {
                'janeiro': 0, 'fevereiro': 1, 'março': 2, 'abril': 3,
                'maio': 4, 'junho': 5, 'julho': 6, 'agosto': 7,
                'setembro': 8, 'outubro': 9, 'novembro': 10, 'dezembro': 11,
                'marco': 2
            };
            
            let mesOriginal = mesStr.toLowerCase();
            let m, y;
            if (mesOriginal.includes(' de ')) {
                let parts = mesOriginal.split(' de ');
                m = months[parts[0]];
                y = parseInt(parts[1]);
            } else if (mesOriginal.includes('/')) {
                let parts = mesOriginal.split('/');
                m = months[parts[0]];
                y = parseInt(parts[1]);
            }

            if (m === undefined || isNaN(y)) return "";
            let numSemana = parseInt(semNome);
            if (isNaN(numSemana)) return "";

            // Procurar o primeiro domingo como marco inicial da 1ª Semana
            let firstSunday = 1;
            let d = new Date(y, m, firstSunday);
            while (d.getDay() !== 0) {
                firstSunday++;
                d = new Date(y, m, firstSunday);
            }
            
            let startD = new Date(y, m, firstSunday + (numSemana - 1) * 7);
            let endD = new Date(y, m, firstSunday + (numSemana - 1) * 7 + 6);
            
            const formatDay = (dateObj) => String(dateObj.getDate()).padStart(2, '0');
            return `(De ${formatDay(startD)} a ${formatDay(endD)})`;
        };

        mesData.semanas.forEach(sem => {
            totalLucroMes += sem.lucro;
            totalDespesaMes += sem.despesa;
            
            let dataRangeHtml = getWeekDateRange(mesData.mes, sem.nome);
            
            semanasHtml += `
            <div class="list-item" style="border-left: 3px solid var(--accent-blue); background: rgba(0,0,0,0.2) !important; margin-bottom: 0.5rem; padding: 1rem;">
                <div style="flex-grow: 1;">
                    <div class="item-title" style="font-size: 0.95rem; display: flex; align-items: flex-start; gap: 8px;">
                        <i class="fa fa-calendar-week" style="color: var(--text-secondary); margin-top: 3px;"></i> 
                        <div style="line-height: 1.2;">
                            <span style="font-weight: 600;">${sem.nome}</span>
                            <div style="font-size: 0.75rem; color: var(--text-secondary); font-weight: normal; margin-top: 2px;">${dataRangeHtml}</div>
                        </div>
                    </div>
                </div>
                <div style="text-align: right; display: flex; flex-direction: column; gap: 4px;">
                    <div style="color: var(--accent-green); font-size: 0.85rem; font-weight: 600;">+ ${formatBRL(sem.lucro)} (Ganhos)</div>
                    <div style="color: var(--accent-red); font-size: 0.85rem; font-weight: 600;">- ${formatBRL(sem.despesa)} (Gastos)</div>
                </div>
            </div>`;
        });

        const saldoMes = totalLucroMes - totalDespesaMes;
        const corSaldo = saldoMes >= 0 ? "var(--accent-green)" : "var(--accent-red)";

        list.innerHTML += `
        <div class="card premium-card" style="margin-bottom: 1.5rem; padding: 1rem;">
            <h3 style="margin-bottom: 1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; text-transform: capitalize;"><i class="fa fa-calendar-alt" style="color: var(--accent-blue);"></i> ${mesData.mes}</h3>
            ${semanasHtml}
            <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
                <h4 style="color: var(--text-primary); margin: 0;">Resumo Mensal</h4>
                <div style="text-align: right;">
                    <div style="color: var(--accent-green); font-size: 0.85rem;"><span style="color:var(--text-secondary)">Total Receitas:</span> ${formatBRL(totalLucroMes)}</div>
                    <div style="color: var(--accent-red); font-size: 0.85rem;"><span style="color:var(--text-secondary)">Total Gastos:</span> ${formatBRL(totalDespesaMes)}</div>
                    <div style="font-weight: 800; color: ${corSaldo}; font-size: 1.1rem; margin-top: 6px;">Saldo: ${formatBRL(saldoMes)}</div>
                </div>
            </div>
        </div>`;
    });
}

window.fecharSemanaAuto = function() {
    const overlay = document.createElement('div');
    overlay.id = "wait-overlay";
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.backgroundColor = 'rgba(0,0,0,0.85)';
    overlay.style.zIndex = '9999';
    overlay.style.display = 'flex';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    overlay.style.flexDirection = 'column';
    
    overlay.innerHTML = `
        <i class="fa fa-spinner fa-spin" style="font-size: 3rem; color: var(--accent-blue); margin-bottom: 20px;"></i>
        <h2 style="color: white; margin: 0; text-align: center;">Ajuste Semanal<br>Em Andamento...</h2>
        <p style="color: var(--text-secondary); margin-top: 10px;">Calculando e guardando históricos...</p>
    `;
    document.body.appendChild(overlay);

    setTimeout(() => {
        fecharSemana();
        document.body.removeChild(overlay);
        customAlert("Fechamento semanal automático concluído!", "success");
    }, 2500); // 2.5s delay to assure the user the system is heavily processing the data
};

window.fecharSemana = function() {
    if (!appState.inventarioAnual) appState.inventarioAnual = [];

    // O fechamento ocorre geralmente no domingo e engloba a semana que passou.
    // Subtraímos 24h para que o momento de referência (mês e semana) seja o sábado.
    const refDate = new Date();
    refDate.setHours(refDate.getHours() - 24);

    const formatter = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });
    let mesStr = formatter.format(refDate);
    // Capitalize properly without issues ("Agosto de 2026")
    mesStr = mesStr.replace(/^\w/, c => c.toUpperCase());

    const lucroSemana = appState.lucroSemanal || 0;
    const despesaSemana = appState.despesasSemanal || 0;

    let idxMes = appState.inventarioAnual.findIndex(m => m.mes.toLowerCase() === mesStr.toLowerCase());
    
    if (idxMes === -1) {
        appState.inventarioAnual.push({
            mes: mesStr,
            semanas: []
        });
        idxMes = appState.inventarioAnual.length - 1;
    }

    const y = refDate.getFullYear();
    const m = refDate.getMonth();
    let firstSunday = 1;
    let d = new Date(y, m, firstSunday);
    while (d.getDay() !== 0) {
        firstSunday++;
        d = new Date(y, m, firstSunday);
    }
    
    let diffDays = refDate.getDate() - firstSunday;
    let numSemanaReal = 1;
    if (diffDays >= 0) {
        numSemanaReal = Math.floor(diffDays / 7) + 1;
    }
    
    let baseNome = numSemanaReal + "ª Semana";
    let finalNome = baseNome;
    let counter = 2;
    while(appState.inventarioAnual[idxMes].semanas.find(s => s.nome === finalNome)) {
        finalNome = baseNome + " (Fechamento " + counter + ")";
        counter++;
    }
    
    appState.inventarioAnual[idxMes].semanas.push({
        nome: finalNome,
        lucro: lucroSemana,
        despesa: despesaSemana
    });

    // Limpa o extrato (Saldos semanais são preservados para manipulação manual)
    appState.transacoes = [];

    // Limpa o histórico de fretes da semana de cada motorista
    if (appState.funcionarios) {
        appState.funcionarios.forEach(f => {
            f.historico = [];
        });
    }

    saveState();
    updateDashboard();
};

// Funções de Sincronização (Nuvem)
function openSyncModal() {
    // Gera o código atual compactado
    const str = JSON.stringify(appState);
    
    let code = "";
    if (typeof LZString !== 'undefined') {
        // Usa LZString para compressão (novo método, reduz muito o tamanho para Whatsapp)
        code = "LZ|" + LZString.compressToBase64(str);
    } else {
        // Fallback para o modo antigo caso a biblioteca falhe no carregamento
        code = btoa(unescape(encodeURIComponent(str)));
    }
    
    document.getElementById('sync-export-code').value = code;
    document.getElementById('sync-import-code').value = "";
    document.getElementById('sync-modal').classList.remove('hidden');
}

function copySyncCode() {
    const codeInput = document.getElementById('sync-export-code');
    codeInput.select();
    document.execCommand("copy");
    customAlert("Código copiado! Cole no outro dispositivo.", "success");
}

function importSyncCode() {
    const code = document.getElementById('sync-import-code').value.trim();
    if (!code) {
        customAlert("Cole o código gerado pelo seu outro dispositivo primeiro!", "error");
        return;
    }
    
    if(confirm("ATEN�!ÒO: Isso vai APAGAR O PROGRESSO ATUAL deste dispositivo e carregar as informações do código colado. Tem certeza?")) {
        try {
            let decodedJson = "";
            if (code.startsWith("LZ|")) {
                // Modo Novo Compressado
                const compressedData = code.substring(3);
                decodedJson = LZString.decompressFromBase64(compressedData);
                if (!decodedJson) {
                     throw new Error("Falha ao descompactar os dados");
                }
            } else {
                // Modo Antigo Base64 Padrão
                decodedJson = decodeURIComponent(escape(atob(code)));
            }

            const newState = JSON.parse(decodedJson);
            
            if(newState && (newState.saldo !== undefined)) {
                appState = newState;
                saveState();
                updateDashboard();
                closeModal('sync-modal');
                customAlert("Dados sincronizados com sucesso! �xaa", "success");
            } else {
                 customAlert("Código inválido ou incompleto.", "error");
            }
        } catch(e) {
            console.error("Erro ao importar código de sync:", e);
            customAlert("Erro ao ler o código. Certifique-se de que copiou TUDO do outro lado.", "error");
        }
    }
}

// Iniciar a aplicação
document.addEventListener('DOMContentLoaded', loadState);

// Bloquear Inserção de Emojis em todos os inputs
document.body.addEventListener('input', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        const originalVal = e.target.value;
        const noEmoji = originalVal.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{1F600}-\u{1F64F}\u{25FB}-\u{25FE}]/gu, '');
        if (originalVal !== noEmoji) {
            e.target.value = noEmoji;
            customAlert("Emojis não são permitidos nesta aplicação corporativa.", "error");
        }
    }
});

// ============================================
// Lógica da Calculadora Flutuante
// ============================================
let calcCurrentInput = '0';
let calcPreviousInput = '';
let calcOperation = null;
let calcJustEqualed = false;

window.toggleCalculator = function() {
    const calc = document.getElementById('mini-calculator');
    calc.classList.toggle('hidden');
};

window.calcInput = function(key) {
    const display = document.getElementById('calc-display');
    
    if (key === 'C') {
        calcCurrentInput = '0';
        calcPreviousInput = '';
        calcOperation = null;
        calcJustEqualed = false;
        display.value = calcCurrentInput;
        return;
    }
    
    if (key === 'Backspace') {
        if (calcJustEqualed) {
            calcCurrentInput = '0';
            calcJustEqualed = false;
        } else if (calcCurrentInput.length > 1) {
            calcCurrentInput = calcCurrentInput.slice(0, -1);
            if (calcCurrentInput === '-') calcCurrentInput = '0';
        } else {
            calcCurrentInput = '0';
        }
        display.value = calcCurrentInput;
        return;
    }
    
    if (['+', '-', '*', '/'].includes(key)) {
        if (calcOperation !== null && !calcJustEqualed && calcCurrentInput !== '0') {
            calcInput('='); 
        }
        calcOperation = key;
        calcPreviousInput = calcCurrentInput;
        calcCurrentInput = '0';
        calcJustEqualed = false;
        return;
    }
    
    if (key === '=') {
        if (calcOperation === null || calcPreviousInput === '') return;
        
        let prev = parseFloat(calcPreviousInput);
        let curr = parseFloat(calcCurrentInput);
        let result = 0;
        
        switch (calcOperation) {
            case '+': result = prev + curr; break;
            case '-': result = prev - curr; break;
            case '*': result = prev * curr; break;
            case '/': result = curr !== 0 ? prev / curr : 0; break;
        }
        
        calcCurrentInput = result.toString();
        // format nicely if too many decimals
        if (calcCurrentInput.indexOf('.') !== -1 && calcCurrentInput.split('.')[1].length > 4) {
            calcCurrentInput = parseFloat(result.toFixed(4)).toString();
        }
        
        display.value = calcCurrentInput;
        calcOperation = null;
        calcPreviousInput = '';
        calcJustEqualed = true;
        return;
    }
    
    // Numbers and dot
    if (calcJustEqualed) {
        calcCurrentInput = key === '.' ? '0.' : key;
        calcJustEqualed = false;
    } else {
        if (key === '.') {
            if (!calcCurrentInput.includes('.')) calcCurrentInput += '.';
        } else {
            if (calcCurrentInput === '0') {
                calcCurrentInput = key;
            } else {
                calcCurrentInput += key;
            }
        }
    }
    display.value = calcCurrentInput;
};

// Tornar a calculadora arrastável (movível)
const calcHeader = document.getElementById('calc-header');
const calculator = document.getElementById('mini-calculator');
let isDraggingCalc = false;
let calcStartX, calcStartY, calcInitialLeft, calcInitialTop;

calcHeader.addEventListener('mousedown', (e) => {
    isDraggingCalc = true;
    const rect = calculator.getBoundingClientRect();
    calcInitialLeft = rect.left;
    calcInitialTop = rect.top;
    calcStartX = e.clientX;
    calcStartY = e.clientY;
    
    calculator.style.bottom = 'auto';
    calculator.style.right = 'auto';
    calculator.style.left = calcInitialLeft + 'px';
    calculator.style.top = calcInitialTop + 'px';
    calculator.style.margin = '0';
    calcHeader.style.cursor = 'grabbing';
});

window.addEventListener('mousemove', (e) => {
    if (!isDraggingCalc) return;
    e.preventDefault();
    const dx = e.clientX - calcStartX;
    const dy = e.clientY - calcStartY;
    
    let newLeft = calcInitialLeft + dx;
    let newTop = calcInitialTop + dy;
    
    // Keep within window bounds
    if (newLeft < 0) newLeft = 0;
    if (newTop < 0) newTop = 0;
    if (newLeft + calculator.offsetWidth > window.innerWidth) newLeft = window.innerWidth - calculator.offsetWidth;
    if (newTop + calculator.offsetHeight > window.innerHeight) newTop = window.innerHeight - calculator.offsetHeight;
    
    calculator.style.left = newLeft + 'px';
    calculator.style.top = newTop + 'px';
});

window.addEventListener('mouseup', () => {
    if (isDraggingCalc) {
        isDraggingCalc = false;
        calcHeader.style.cursor = 'move';
    }
});

// Suporte para touch dragging
calcHeader.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    isDraggingCalc = true;
    const rect = calculator.getBoundingClientRect();
    calcInitialLeft = rect.left;
    calcInitialTop = rect.top;
    calcStartX = e.touches[0].clientX;
    calcStartY = e.touches[0].clientY;
    
    calculator.style.bottom = 'auto';
    calculator.style.right = 'auto';
    calculator.style.left = calcInitialLeft + 'px';
    calculator.style.top = calcInitialTop + 'px';
    calculator.style.margin = '0';
}, {passive: false});

window.addEventListener('touchmove', (e) => {
    if (!isDraggingCalc) return;
    e.preventDefault();
    const dx = e.touches[0].clientX - calcStartX;
    const dy = e.touches[0].clientY - calcStartY;
    
    let newLeft = calcInitialLeft + dx;
    let newTop = calcInitialTop + dy;
    
    if (newLeft < 0) newLeft = 0;
    if (newTop < 0) newTop = 0;
    if (newLeft + calculator.offsetWidth > window.innerWidth) newLeft = window.innerWidth - calculator.offsetWidth;
    if (newTop + calculator.offsetHeight > window.innerHeight) newTop = window.innerHeight - calculator.offsetHeight;
    
    calculator.style.left = newLeft + 'px';
    calculator.style.top = newTop + 'px';
}, {passive: false});

window.addEventListener('touchend', () => {
    isDraggingCalc = false;
});

// ==========================================
// CONTABILIDADE ATK (TELEMETRIA LIVE SYNC)
// ==========================================
let telemetryInterval = null;
let isTelemetryActive = false;
let globalTelemetryTimeout = null;

window.handleTelemetryData = function(data) {
    if (globalTelemetryTimeout) clearTimeout(globalTelemetryTimeout);
    
    // Sucesso, recebemos os dados!
    document.getElementById('telemetry-status-badge').textContent = "ON-LINE (AO VIVO)";
    document.getElementById('telemetry-status-badge').style.background = "var(--accent-green)";
    document.getElementById('telemetry-dashboard').style.opacity = "1";
    
    updateTelemetryUI(data);
};

window.toggleTelemetry = function() {
    const btn = document.getElementById('telemetry-btn-text').parentElement;
    const btnText = document.getElementById('telemetry-btn-text');
    const badge = document.getElementById('telemetry-status-badge');
    const dashboard = document.getElementById('telemetry-dashboard');
    
    if (isTelemetryActive) {
        // Desligar
        clearInterval(telemetryInterval);
        isTelemetryActive = false;
        
        btnText.textContent = "Conectar Radar";
        btn.classList.remove('success');
        btn.classList.add('info');
        btn.style.backgroundColor = 'var(--accent-blue)';
        
        badge.textContent = "DESCONECTADO";
        badge.style.background = "var(--text-secondary)";
        dashboard.style.opacity = "0.5";
        
        customAlert("Radar de Telemetria Desconectado.", 'success');
    } else {
        // Ligar
        const url = document.getElementById('telemetry-url').value;
        if (!url) {
            customAlert("Por favor informe o endereço IP do Servidor!");
            return;
        }
        
        // Salva url preferida para as proximas sessoes
        localStorage.setItem('atk_telemetry_url', url);

        isTelemetryActive = true;
        btnText.textContent = "Desconectar Radar";
        btn.classList.remove('info');
        btn.classList.add('success');
        btn.style.backgroundColor = 'var(--accent-green)';
        
        badge.textContent = "CONECTANDO...";
        badge.style.background = "var(--accent-blue)";
        dashboard.style.opacity = "0.8";

        fetchTelemetryData(url);
        
        telemetryInterval = setInterval(() => {
            fetchTelemetryData(url);
        }, 2000);
    }
};

function fetchTelemetryData(url) {
    // Gerenciar Timeout manually
    globalTelemetryTimeout = setTimeout(() => {
        const badge = document.getElementById('telemetry-status-badge');
        badge.textContent = "SEM SINAL / OFF";
        badge.style.background = "var(--accent-red)";
    }, 1500);

    const onDataSuccess = (data) => {
        if (globalTelemetryTimeout) clearTimeout(globalTelemetryTimeout);
        document.getElementById('telemetry-status-badge').textContent = "ON-LINE (AO VIVO)";
        document.getElementById('telemetry-status-badge').style.background = "var(--accent-green)";
        document.getElementById('telemetry-dashboard').style.opacity = "1";
        updateTelemetryUI(data);
    };

    const onDataError = (err) => {
        if (globalTelemetryTimeout) clearTimeout(globalTelemetryTimeout);
        console.error("Erro na telemetria:", err);
        const badge = document.getElementById('telemetry-status-badge');
        if ((err.message && err.message.includes("fetch")) || err.name === "TypeError" || err.status === -1) {
            badge.textContent = "SEM RESPOSTA DO SERVIDOR (PC)";
        } else {
            badge.textContent = "ERRO: " + (err.message || err.error || err.status);
        }
        badge.style.background = "var(--accent-red)";
    };

    if (window.cordova && cordova.plugin && cordova.plugin.http) {
        // Native HTTP bypassa CORS
        cordova.plugin.http.get(url, {}, {}, 
            function(response) {
                try {
                    const data = JSON.parse(response.data);
                    onDataSuccess(data);
                } catch(e) {
                    onDataError(e);
                }
            }, 
            function(response) {
                onDataError(response);
            }
        );
    } else {
        // Web standard fetch para Desktop/Browser
        fetch(url, { mode: 'cors' })
            .then(response => {
                if (!response.ok) throw new Error("HTTP " + response.status);
                return response.json();
            })
            .then(onDataSuccess)
            .catch(onDataError);
    }
}

function updateTelemetryUI(data) {
    if (!data) return;

    // Converte e atualiza Tempo do Jogo (se disponível)
    if (data.game && data.game.time) {
        const gameDate = new Date(data.game.time);
        if (!isNaN(gameDate)) {
            const h = gameDate.getUTCHours().toString().padStart(2, '0');
            const m = gameDate.getUTCMinutes().toString().padStart(2, '0');
            const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
            const dayName = days[gameDate.getUTCDay()];
            document.getElementById('tel-game-time').innerHTML = `<i class="fa fa-clock" style="font-size: 1.3rem; margin-right: 5px;"></i> ${dayName} ${h}:${m}`;
        }
    }

    // Status do Caminhão
    if (data.truck) {
        // Considera ligado se: electricOn OU engineOn OU velocidade > 0 (em movimento real)
        // O fallback de speed > 0 corrige o bug em carreiras novas onde os flags podem
        // chegar como false mesmo com o caminhão em pleno movimento.
        const truckIsActive = data.truck.electricOn || data.truck.engineOn || Math.abs(data.truck.speed || 0) > 0.5;
        if (truckIsActive) {
            const speedKmh = Math.abs(data.truck.speed || 0).toFixed(0); 
            document.getElementById('tel-speed').textContent = speedKmh + " km/h";
            
            const fuel = Math.max(0, data.truck.fuel || 0).toFixed(0);
            document.getElementById('tel-fuel').textContent = fuel + " L";
            
            const dmg = Math.max(0, (data.truck.damage || data.truck.wearEngine || 0) * 100).toFixed(1);
            document.getElementById('tel-damage').textContent = dmg + "%";
        } else {
            document.getElementById('tel-speed').textContent = "0 km/h";
            document.getElementById('tel-fuel').textContent = "OFF";
            document.getElementById('tel-damage').textContent = "OFF";
        }
    }

    // Status do Reboque / Trailer
    if (data.trailer && data.trailer.attached) {
        const trDmg = Math.max(0, (data.trailer.damage || data.trailer.wear || 0) * 100).toFixed(1);
        document.getElementById('tel-trailer-damage').textContent = trDmg + "%";
    } else {
        document.getElementById('tel-trailer-damage').textContent = "0%";
    }

    // Trabalho/Carga (Job)
    const elCargo = document.getElementById('tel-cargo');
    const elSource = document.getElementById('tel-source');
    const elDest = document.getElementById('tel-dest');
    const elIncome = document.getElementById('tel-income');

    // A API nativa do jogo SDK exporta o valor Universal (EURO), 
    // Precisamos aplicar a taxa de câmbio Oficial do jogo para BRL (Reais).
    // O ETS2 base atualmente usa uma cotação de aproximadamente ~5.86 para o Real.
    const TAXA_BRL = 5.86;

    let hasJob = false;
    if (data.job) {
        // Detecta job ativo de forma robusta: income > 0, OU cidade destino preenchida, OU trailer acoplado com carga
        if (data.job.income > 0 || 
            (data.job.destinationCity && data.job.destinationCity.trim() !== '') ||
            (data.trailer && data.trailer.attached && data.trailer.name)) {
            hasJob = true;
        }
    }

    if (hasJob) {
        // Nome da carga: A API da Funbit puxa melhor o nome via data.trailer.name
        if (data.trailer && data.trailer.name) {
            const massInTons = Math.round((data.trailer.mass || 0) / 1000);
            elCargo.textContent = `${data.trailer.name} (${massInTons} t)`;
        } else if (data.job.cargo) {
            elCargo.textContent = data.job.cargo;
        } else {
            elCargo.textContent = "Carga Desconhecida";
        }

        elSource.innerHTML = `<i class="fa fa-map-marker-alt" style="color: var(--accent-red);"></i> ${data.job.sourceCity || "----"}`;
        elDest.innerHTML = `<i class="fa fa-flag-checkered" style="color: var(--accent-blue);"></i> ${data.job.destinationCity || "----"}`;
        
        // Converte o valor em Euro do jogo para Reais
        const incomeEmEuro = data.job.income || 0;
        const incomeConvertido = Math.round(incomeEmEuro * TAXA_BRL);
        
        elIncome.textContent = incomeConvertido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    } else {
        elCargo.textContent = "Sem Carga";
        elSource.innerHTML = `<i class="fa fa-map-marker-alt" style="color: var(--accent-red);"></i> ----`;
        elDest.innerHTML = `<i class="fa fa-flag-checkered" style="color: var(--accent-blue);"></i> ----`;
        elIncome.textContent = "R$ 0,00";
    }

    // Fadiga / Descanso
    const telRestEl = document.getElementById('tel-rest');
    const telRestIcon = document.getElementById('tel-rest-icon');
    if (telRestEl) {
        if (data.game && data.game.nextRestStopTime) {
            
            // O pulo do gato: A telemetria Ets2Telemetry envia o Tempo Restante de Descanso
            // como um TimeSpan (Tempo Relativo) base do C# e não como um relógio Data absoluta.
            // Exemplo: "0001-01-01T11:00:00Z" significa 11 horas e 0 minutos RESTANTES! (e não dia 1o de janeiro)
            const rawNext = data.game.nextRestStopTime;
            const nextRest = new Date(rawNext);
            
            if (isNaN(nextRest)) {
                telRestEl.textContent = "OFF";
                telRestIcon.style.color = "var(--text-secondary)";
                telRestEl.style.color = "var(--text-secondary)";
            } else {
                let diffDays = nextRest.getUTCDate() - 1; // 1 = 0 dias, 2 = 1 dia
                let diffHrs = nextRest.getUTCHours() + (diffDays * 24);
                let diffMins = nextRest.getUTCMinutes();
                
                // Salva guarda: Caso outro plugin envie data pura absoluta em vez de TimeSpan, 
                // a diferença seria de milhares de horas, então subtraímos para garantir.
                if (diffHrs > 100 && data.game.time) {
                    const gameTime = new Date(data.game.time);
                    let absMs = nextRest - gameTime;
                    if (absMs < 0) absMs = 0;
                    diffHrs = Math.floor(absMs / 3600000);
                    diffMins = Math.floor((absMs % 3600000) / 60000);
                }

                if (diffHrs === 0 && diffMins === 0) {
                   telRestEl.textContent = "ESGOTADO"; 
                   telRestIcon.style.color = 'var(--accent-red)';
                   telRestEl.style.color = 'var(--accent-red)';
                } else {
                   telRestEl.textContent = `${diffHrs}h ${diffMins}m`;
                   
                   // Alertas baseados nas horas restantes
                   if (diffHrs <= 2) {
                       telRestIcon.style.color = '#f59e0b'; // Amarelo de Alerta (Perto de acabar)
                       telRestEl.style.color = '#f59e0b';
                   } else {
                       telRestIcon.style.color = '#10b981'; // Verde (Ainda pode dirigir bem)
                       telRestEl.style.color = 'var(--text-primary)';
                   }
                }
            }
        } else {
            telRestEl.textContent = "---";
            telRestIcon.style.color = "var(--text-secondary)";
            telRestEl.style.color = "var(--text-secondary)";
        }
    }

    // Distância
    const telDistEl = document.getElementById('tel-distance');
    if (telDistEl) {
        if (data.navigation) {
            let distMeters = 0;
            if (data.navigation.estimatedDistance !== undefined) {
                distMeters = data.navigation.estimatedDistance;
            } else if (data.navigation.distance !== undefined) {
                distMeters = data.navigation.distance;
            }
            
            if (distMeters > 0) {
                const distKm = Math.round(distMeters / 1000);
                telDistEl.textContent = `${distKm} km`;
            } else {
                telDistEl.textContent = "0 km";
            }
        } else {
            telDistEl.textContent = "---";
        }
    }
}

// Funções para a Apostila Interativa (Hotspots)
let zoomTimer = null;
window.zoomApostila = function(imageId, leftPercent, topPercent) {
    const img = document.getElementById(imageId);
    if(img) {
        if(zoomTimer) clearTimeout(zoomTimer);
        img.style.transformOrigin = `${leftPercent}% ${topPercent}%`;
        img.style.transform = "scale(1.8)";
        zoomTimer = setTimeout(() => {
            img.style.transform = "scale(1)";
        }, 3500);
    }
};

window.resetZoom = function(imageId) {
    const img = document.getElementById(imageId);
    if(img) {
        img.style.transform = "scale(1)";
    }
};


window.checkOccupiedDriver = function(selectEl) {
    const val = selectEl.value;
    if (!val) return;
    const hasTruck = appState.caminhoes && appState.caminhoes.find(c => String(c.motoristaId) === String(val));
    if (hasTruck) {
        if (!confirm('Opa! Este motorista já está com o caminhão ' + hasTruck.modelo + ' - ' + hasTruck.placa + '.\n\nDeseja retirar ele do caminhão anterior e colocar neste novo?\n(Se clicar cancel, ele ficará sem motorista)')) {
            selectEl.value = '';
        }
    }
};

window.checkOccupiedTruck = function(selectEl) {
    const val = selectEl.value;
    if (!val) return;
    const hasTrailer = appState.reboques && appState.reboques.find(r => String(r.caminhaoId) === String(val));
    if (hasTrailer) {
        if (!confirm('Atenção! Este caminhão já possui o reboque ' + hasTrailer.modelo + ' atrelado.\n\nDeseja soltar o anterior e atrelar a esse novo?\n(Se clicar cancel, ficará solto na garagem)')) {
            selectEl.value = '';
        }
    }
};

let gridZoomTimer = null;
window.zoomGridApostila = function(imgEl) {
    if(gridZoomTimer) clearTimeout(gridZoomTimer);
    imgEl.style.transform = 'scale(1.5)';
    imgEl.style.zIndex = '10';
    imgEl.style.position = 'relative';
    gridZoomTimer = setTimeout(() => {
        imgEl.style.transform = 'scale(1)';
        imgEl.style.zIndex = '1';
    }, 3500);
};
