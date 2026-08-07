import { useState, useEffect, useCallback, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import TopbarAvatar from '@/components/layout/TopbarAvatar';
import { supabase, fetchEquipamentos } from '@/lib/supabase';
import { fetchCompetencias, fetchFolhaDescontos } from '@/modules/folha/services/folhaService';
import { fmtCompetencia } from '@/modules/folha/constants';
import { useAuth } from '@/contexts/AuthContext';
import MarkerClusterGroup from 'react-leaflet-cluster';
import { MapPin } from 'lucide-react';
import { matchUnidade } from '@/lib/utils';
import { SECRETARIAS } from '@/lib/secretarias';

function isExactSecretariaMatch(secCandidate, userSecretaria) {
  if (!userSecretaria || !secCandidate) return false;
  const target = String(userSecretaria).toUpperCase().trim();
  const candidate = String(secCandidate).toUpperCase().trim();

  if (candidate === target) return true;

  const secMeta = SECRETARIAS.find(s => 
    s.sigla.toUpperCase() === target || 
    s.codigo.toUpperCase() === target || 
    s.numero === target
  );

  if (secMeta) {
    if (candidate === secMeta.sigla.toUpperCase()) return true;
    if (candidate === secMeta.codigo.toUpperCase()) return true;
    if (candidate === secMeta.numero) return true;
    if (candidate === secMeta.nome.toUpperCase()) return true;
  }
  return false;
}

// Tabela "De-Para" para forçar o cruzamento de órgãos da Folha com prédios físicos
const CUSTOM_ALIASES = {
  'secretaria de servicos e obras sso': 'obras gabinete',
};

// Função para gerar coordenadas em Osasco baseadas no nome (distribuição uniforme)
function getMockCoords(eq) {
  let seed = 0;
  const seedStr = (eq.nome || 'eq') + eq.id;
  for (let i = 0; i < seedStr.length; i++) {
    seed = Math.imul(31, seed) + seedStr.charCodeAt(i) | 0;
  }
  
  function random(s) {
    let x = Math.sin(s) * 10000;
    return x - Math.floor(x);
  }

  const minLat = -23.58;
  const maxLat = -23.51;
  const minLng = -46.82;
  const maxLng = -46.75;

  const lat = minLat + random(seed) * (maxLat - minLat);
  const lng = minLng + random(seed + 1) * (maxLng - minLng);

  return [lat, lng];
}

const normalize = (s) => s ? s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/face/g, '').replace(/[^a-z0-9]/g, ' ').replace(/\bsed\b/g, 'sede').replace(/\s+/g, ' ').trim() : '';

export default function MapaDescontos() {
  const { sessao, isApoio } = useAuth();
  const [competencias, setCompetencias] = useState([]);
  const [competencia, setCompetencia] = useState('');
  const [equipamentos, setEquipamentos] = useState([]);
  const [descontos, setDescontos] = useState([]);
  const [status, setStatus] = useState('Carregando mapa...');

  const carregarCompetencias = async () => {
    try {
      const comps = await fetchCompetencias();
      setCompetencias(comps);
      if (comps.length > 0) {
        setCompetencia(comps[0]);
      }
    } catch (err) {
      console.error(err);
      setStatus('Erro ao carregar competências');
    }
  };

  const carregarEquipamentos = async () => {
    try {
      const eqs = await fetchEquipamentos();
      setEquipamentos(eqs);
    } catch (err) {
      console.error(err);
    }
  };

  const carregarDadosMapa = useCallback(async () => {
    if (!competencia) return;
    setStatus('Carregando dados da folha...');
    try {
      let descData = await fetchFolhaDescontos(competencia);
      
      // Aplicar filtro de perfil Apoio
      if (isApoio) {
        let unidadesParaBuscar = (sessao?.unidades && !sessao.unidades.includes('*') && sessao.unidades.length > 0) ? [...sessao.unidades] : [];
        let filterSec = !!sessao?.secretaria;

        if (sessao?.secretaria) {
          const isRealSecretaria = isExactSecretariaMatch('SS', sessao.secretaria) || 
                                   SECRETARIAS.some(s => isExactSecretariaMatch(s.sigla, sessao.secretaria) || isExactSecretariaMatch(s.nome, sessao.secretaria));
          
          if (!isRealSecretaria) {
            filterSec = false;
            if (!unidadesParaBuscar.includes(sessao.secretaria)) unidadesParaBuscar.push(sessao.secretaria);
          }
        }

        if (filterSec) {
          descData = descData.filter(d => 
            isExactSecretariaMatch(d.secretaria_codigo, sessao.secretaria) ||
            isExactSecretariaMatch(d.secretaria_sigla, sessao.secretaria) ||
            isExactSecretariaMatch(d.secretaria_nome, sessao.secretaria) ||
            isExactSecretariaMatch(d.secretaria, sessao.secretaria)
          );
        }

        if (unidadesParaBuscar.length > 0) {
          descData = descData.filter(d => {
            if (!d.unidade) return false;
            return unidadesParaBuscar.some(u => matchUnidade(u, d.unidade));
          });
        }
      }

      setDescontos(descData);
      
      const totalOcorrencias = descData.reduce((acc, d) => acc + (d.totalOcorrencias || 0), 0);
      setStatus(
        `Atualizado em ${new Date().toLocaleDateString('pt-BR')} · ${totalOcorrencias} ocorrências registradas em ${fmtCompetencia(competencia)}`
      );
    } catch (err) {
      console.error(err);
      setStatus('Erro ao carregar dados da folha');
    }
  }, [competencia, isApoio, sessao]);

  useEffect(() => {
    carregarCompetencias();
    carregarEquipamentos();
  }, []);

  useEffect(() => {
    carregarDadosMapa();
  }, [carregarDadosMapa]);

  // Centro de Osasco
  const position = [-23.5329, -46.7916];

  const unitDescontos = useMemo(() => {
    const map = {};
    descontos.forEach(d => {
      const cleanName = (d.unidade || '').replace(/^[\d\s\-]+/, '');
      let u = normalize(cleanName);
      
      // Aplica o De-Para se existir
      if (CUSTOM_ALIASES[u]) {
        u = CUSTOM_ALIASES[u];
      }

      if (u) {
        if (!map[u]) map[u] = [];
        map[u].push(d);
      }
    });
    return map;
  }, [descontos]);

  const mediaOcorrencias = useMemo(() => {
    let sum = 0;
    let count = 0;
    for (const regs of Object.values(unitDescontos)) {
      sum += regs.reduce((s, r) => s + (r.totalOcorrencias || 0), 0);
      count++;
    }
    return count > 0 ? sum / count : 0;
  }, [unitDescontos]);

  const getColor = useCallback((count) => {
    if (mediaOcorrencias === 0) return '#0D7C3D';
    if (count <= mediaOcorrencias * 0.5) return '#0D7C3D'; // Verde (muito abaixo da média)
    if (count <= mediaOcorrencias * 1.5) return '#f5a623'; // Laranja (em torno da média)
    if (count <= mediaOcorrencias * 3.0) return '#ff4d4f'; // Vermelho (acima da média)
    return '#8b5cf6'; // Roxo (crítico, muito acima da média)
  }, [mediaOcorrencias]);

  const createCustomClusterIcon = useCallback((cluster) => {
    const markers = cluster.getAllChildMarkers();
    let totalOcorrencias = 0;
    markers.forEach(marker => {
      totalOcorrencias += marker.options.ticketCount || 0;
    });

    const avgCluster = markers.length > 0 ? totalOcorrencias / markers.length : 0;
    const color = getColor(avgCluster);

    return L.divIcon({
      html: `<div style="background-color: ${color}; width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 15px; border: 3px solid rgba(255,255,255,0.8); box-shadow: 0 4px 6px rgba(0,0,0,0.3);">${totalOcorrencias}</div>`,
      className: 'custom-marker-cluster',
      iconSize: L.point(44, 44, true),
    });
  }, [getColor]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="topbar">
        <div className="topbar-left" style={{ flex: 1 }}>
          <h1>Mapa de Descontos</h1>
          <p>{status}</p>
        </div>
        
        {/* Selector de Competência Centralizado */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-c)', padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border-c)' }}>
            <span style={{ fontSize: '12px', color: 'var(--muted-c)', fontWeight: 600 }}>Competência:</span>
            <select 
              value={competencia} 
              onChange={(e) => setCompetencia(e.target.value)}
              style={{ 
                border: 'none', background: 'transparent', color: 'var(--text)', 
                fontSize: '14px', fontWeight: 'bold', cursor: 'pointer', outline: 'none'
              }}
            >
              {competencias.length === 0 && <option value="">Sem dados</option>}
              {competencias.map(c => (
                <option key={c} value={c}>{fmtCompetencia(c)}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="topbar-right" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '16px', justifyContent: 'flex-end' }}>
          <TopbarAvatar />
        </div>
      </div>

      <div className="content" style={{ flex: 1, padding: '24px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, position: 'relative', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-c)', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}>
          
          {/* Legenda do Mapa */}
          <div style={{ 
            position: 'absolute', bottom: 24, left: 24, zIndex: 1000, 
            background: 'var(--bg-c)', padding: '12px 16px', borderRadius: '8px', 
            border: '1px solid var(--border-c)', boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            fontFamily: 'Inter, sans-serif'
          }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', color: 'var(--text)', fontWeight: 600 }}>
              Classificação <span style={{ color: 'var(--muted-c)', fontWeight: 'normal', fontSize: '11px' }}>(Média: {mediaOcorrencias.toFixed(1)})</span>
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px', color: 'var(--muted-c)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: 14, height: 14, borderRadius: '50%', backgroundColor: '#0D7C3D' }} /> <span>Muito Abaixo</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: 14, height: 14, borderRadius: '50%', backgroundColor: '#f5a623' }} /> <span>Na Média</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: 14, height: 14, borderRadius: '50%', backgroundColor: '#ff4d4f' }} /> <span>Acima da Média</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: 14, height: 14, borderRadius: '50%', backgroundColor: '#8b5cf6' }} /> <span>Crítico</span>
              </div>
            </div>
          </div>

          <MapContainer center={position} zoom={13} minZoom={12} style={{ height: '100%', width: '100%', zIndex: 1 }}>
            <TileLayer
              attribution='&copy; Google Maps'
              url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
            />
            
            <MarkerClusterGroup
              chunkedLoading
              iconCreateFunction={createCustomClusterIcon}
              showCoverageOnHover={false}
              maxClusterRadius={60}
            >
              {(() => {
                const markers = [];
                let mockIdCounter = 10000;
                
                const getSimilarity = (str1, str2) => {
                  const w1 = str1.split(' ').filter(x => x.length > 2);
                  const w2 = str2.split(' ').filter(x => x.length > 2);
                  let matches = 0;
                  for (const w of w1) {
                    if (w2.includes(w)) matches++;
                  }
                  if (w1.length === 0 || w2.length === 0) return 0;
                  return matches / Math.min(w1.length, w2.length);
                };

                for (const [unitKey, registros] of Object.entries(unitDescontos)) {
                  let bestEq = null;
                  let bestScore = 0;

                  for (const e of equipamentos) {
                    const n = normalize(e.nome);
                    if (n.includes(unitKey) || unitKey.includes(n)) {
                      bestEq = e;
                      bestScore = 2; // match exato
                      break;
                    }
                    const score = getSimilarity(n, unitKey);
                    if (score > bestScore && score >= 0.5) {
                      bestScore = score;
                      bestEq = e;
                    }
                  }
                  const eq = bestEq;
                  
                  let lat, lng, title, id;
                  
                  if (eq) {
                    lat = eq.latitude || getMockCoords(eq)[0];
                    lng = eq.longitude || getMockCoords(eq)[1];
                    title = registros[0]?.unidade || eq.nome;
                    id = `unit-eq-${eq.id}-${unitKey}`;
                  } else {
                    mockIdCounter++;
                    const mockEq = { nome: registros[0]?.unidade || unitKey, id: mockIdCounter };
                    lat = getMockCoords(mockEq)[0];
                    lng = getMockCoords(mockEq)[1];
                    title = registros[0]?.unidade || unitKey;
                    id = `unit-mock-${mockIdCounter}`;
                  }

                  // Soma o total de ocorrências de todos os servidores daquela unidade
                  const totalOcorrenciasUnidade = registros.reduce((sum, r) => sum + (r.totalOcorrencias || 0), 0);
                  
                  markers.push({
                    id,
                    lat,
                    lng,
                    title,
                    registros,
                    count: totalOcorrenciasUnidade
                  });
                }
                
                return markers.map(marker => {
                  if (marker.count === 0) return null; // Não exibe se não houver ocorrências válidas

                  let singleColor = getColor(marker.count);

                  const singleIcon = L.divIcon({
                      html: `<div style="background-color: ${singleColor}; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 12px; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">${marker.count}</div>`,
                      className: 'custom-single-marker',
                      iconSize: [30, 30],
                  });

                  return (
                    <Marker 
                      key={marker.id} 
                      position={[marker.lat, marker.lng]} 
                      icon={singleIcon}
                      ticketCount={marker.count}
                    >
                      <Popup>
                        <div style={{ fontFamily: 'Inter, sans-serif', minWidth: '260px' }}>
                          <h3 style={{ margin: '0 0 4px 0', fontSize: 14, color: 'var(--text)' }}>{marker.title}</h3>
                          <p style={{ margin: '0 0 12px 0', fontSize: 12, fontWeight: 'bold', color: singleColor, borderBottom: '1px solid var(--border-c)', paddingBottom: '8px' }}>
                            {marker.count} {marker.count === 1 ? 'ocorrência registrada' : 'ocorrências registradas'}
                          </p>
                          
                          <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
                            {marker.registros.filter(r => r.totalOcorrencias > 0).map((r, i) => (
                              <div key={i} style={{ background: 'var(--bg-c)', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-c)', fontSize: '11px' }}>
                                <strong style={{ display: 'block', color: 'var(--text)', marginBottom: '4px' }}>{r.nome} ({r.matricula})</strong>
                                <div style={{ display: 'flex', gap: '8px', color: 'var(--muted-c)', flexWrap: 'wrap' }}>
                                  {r.faltas > 0 && <span style={{ background: 'rgba(255, 77, 79, 0.1)', color: '#ff4d4f', padding: '2px 6px', borderRadius: '4px' }}>{r.faltas} faltas</span>}
                                  {r.atrasos_dia > 0 && <span style={{ background: 'rgba(245, 166, 35, 0.1)', color: '#f5a623', padding: '2px 6px', borderRadius: '4px' }}>{r.atrasos_dia} atrasos {'>'} 1h</span>}
                                  {r.atrasos_fracao > 0 && <span style={{ background: 'rgba(245, 166, 35, 0.1)', color: '#f5a623', padding: '2px 6px', borderRadius: '4px' }}>{r.atrasos_fracao} atrasos {'<'} 1h</span>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  );
                });
              })()}
            </MarkerClusterGroup>
          </MapContainer>
        </div>
      </div>
    </div>
  );
}
