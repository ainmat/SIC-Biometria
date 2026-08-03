import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import TopbarAvatar from '@/components/layout/TopbarAvatar';
import { supabase, fetchEquipamentos, fetchChamados } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import MarkerClusterGroup from 'react-leaflet-cluster';
import { Network, MapPin } from 'lucide-react';

// Ícone premium (SVG embutido) menor
const premiumIcon = new L.divIcon({
  className: 'custom-div-icon',
  html: `
    <div style="
      background-color: #0D7C3D;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      border: 2px solid white;
      box-shadow: 0 3px 5px rgba(0,0,0,0.3);
    ">
      <div style="transform: rotate(45deg); color: white;">
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="3" width="7" height="7" rx="1"></rect><rect x="3" y="14" width="7" height="7" rx="1"></rect><rect x="14" y="14" width="7" height="7" rx="1"></rect></svg>
      </div>
    </div>
  `,
  iconSize: [24, 24],
  iconAnchor: [12, 24],
  popupAnchor: [0, -24],
});

// Função para gerar coordenadas em Osasco baseadas no nome (distribuição uniforme)
function getMockCoords(eq) {
  let seed = 0;
  const seedStr = (eq.nome || 'eq') + eq.id;
  for (let i = 0; i < seedStr.length; i++) {
    seed = Math.imul(31, seed) + seedStr.charCodeAt(i) | 0;
  }
  
  // Função pseudo-aleatória determinística
  function random(s) {
    let x = Math.sin(s) * 10000;
    return x - Math.floor(x);
  }

  // Limites aproximados de Osasco (uma caixa maior para espalhar bem)
  const minLat = -23.58;
  const maxLat = -23.51;
  const minLng = -46.82;
  const maxLng = -46.75;

  const lat = minLat + random(seed) * (maxLat - minLat);
  const lng = minLng + random(seed + 1) * (maxLng - minLng);

  return [lat, lng];
}

export default function MapaEquipamentos() {
  const { isVisitor, isAdmin, isMaster } = useAuth();
  const [dados, setDados] = useState([]);
  const [chamados, setChamados] = useState([]);
  const [status, setStatus] = useState('Carregando mapa...');
  const [viewMode, setViewMode] = useState('pins'); // 'pins' ou 'cluster'
  
  // Estados para edição de localização
  const [editingId, setEditingId] = useState(null);
  const [tempPos, setTempPos] = useState(null);
  const markerRefs = useRef({});

  const handleEditStart = (eq, currentLat, currentLng) => {
    setEditingId(eq.id);
    setTempPos([currentLat, currentLng]);
  };

  const handleEditSave = async (eqId) => {
    if (!tempPos) return;
    try {
      const { error } = await supabase
        .from('equipamentos')
        .update({ latitude: tempPos[0], longitude: tempPos[1] })
        .eq('id', eqId);
      if (error) throw error;
      setEditingId(null);
      setTempPos(null);
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar localização no banco de dados.');
    }
  };

  const carregar = useCallback(async () => {
    try {
      const [eqData, chData] = await Promise.all([
        fetchEquipamentos(),
        fetchChamados()
      ]);
      setDados(eqData);
      setChamados(chData);
      setStatus(
        `Atualizado em ${new Date().toLocaleDateString('pt-BR', {
          day: '2-digit', month: 'long', year: 'numeric',
        })} · ${eqData.length} equipamentos mapeados`
      );
    } catch (err) {
      console.error(err);
      setStatus('Erro ao carregar dados');
    }
  }, []);

  useEffect(() => {
    carregar();
    const ch = supabase
      .channel('equipamentos-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'equipamentos' }, carregar)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [carregar]);

  // Centro de Osasco
  const position = [-23.5329, -46.7916];

  const normalize = (s) => s ? s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/face/g, '').replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim() : '';

  const unitTickets = useMemo(() => {
    const map = {};
    chamados.forEach(c => {
      const u = normalize(c.unidade);
      if (u) {
        if (!map[u]) map[u] = [];
        map[u].push(c);
      }
    });
    return map;
  }, [chamados]);

  const createCustomClusterIcon = (cluster) => {
    const markers = cluster.getAllChildMarkers();
    let totalTickets = 0;
    markers.forEach(marker => {
      totalTickets += marker.options.ticketCount || 0;
    });

    let color = '#0D7C3D'; // Verde (0-10)
    if (totalTickets > 10) color = '#f5a623'; // Laranja (11-40)
    if (totalTickets > 40) color = '#ff4d4f'; // Vermelho (41+)

    return L.divIcon({
      html: `<div style="background-color: ${color}; width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 15px; border: 3px solid rgba(255,255,255,0.8); box-shadow: 0 4px 6px rgba(0,0,0,0.3);">${totalTickets}</div>`,
      className: 'custom-marker-cluster',
      iconSize: L.point(44, 44, true),
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="topbar">
        <div className="topbar-left">
          <h1>Mapa de Equipamentos</h1>
          <p>{status}</p>
        </div>
        <div className="topbar-right" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', background: 'var(--bg-c)', border: '1px solid var(--border-c)', borderRadius: '8px', padding: '4px' }}>
            <button
              onClick={() => setViewMode('pins')}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: 500,
                borderRadius: '6px', cursor: 'pointer', border: 'none',
                background: viewMode === 'pins' ? '#0D7C3D' : 'transparent',
                color: viewMode === 'pins' ? 'white' : 'var(--muted-c)'
              }}
            >
              <MapPin size={14} /> Pinos
            </button>
            <button
              onClick={() => setViewMode('cluster')}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: 500,
                borderRadius: '6px', cursor: 'pointer', border: 'none',
                background: viewMode === 'cluster' ? '#0D7C3D' : 'transparent',
                color: viewMode === 'cluster' ? 'white' : 'var(--muted-c)'
              }}
            >
              <Network size={14} /> Conjuntos
            </button>
          </div>
          <TopbarAvatar />
        </div>
      </div>

      <div className="content" style={{ flex: 1, padding: '24px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-c)', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}>
          <MapContainer center={position} zoom={13} minZoom={12} style={{ height: '100%', width: '100%', zIndex: 1 }}>
            <TileLayer
              attribution='&copy; Google Maps'
              url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
            />
            {viewMode === 'cluster' ? (
              <MarkerClusterGroup
                chunkedLoading
                iconCreateFunction={createCustomClusterIcon}
                showCoverageOnHover={false}
                maxClusterRadius={60}
              >
                {dados.map(eq => {
                  const lat = eq.latitude || getMockCoords(eq)[0];
                  const lng = eq.longitude || getMockCoords(eq)[1];
                  
                  const n = normalize(eq.nome);
                  let unitChamados = [];
                  for (const [key, val] of Object.entries(unitTickets)) {
                    if (n.includes(key) || key.includes(n)) {
                      unitChamados = [...unitChamados, ...val];
                    }
                  }
                  
                  const count = unitChamados.length;
                  
                  // No modo de conjuntos, exibimos apenas locais que tem chamados ativos
                  if (count === 0) return null;

                  let singleColor = '#0D7C3D';
                  if (count > 10) singleColor = '#f5a623';
                  if (count > 40) singleColor = '#ff4d4f';

                  const singleIcon = L.divIcon({
                     html: `<div style="background-color: ${singleColor}; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 12px; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">${count}</div>`,
                     className: 'custom-single-marker',
                     iconSize: [30, 30],
                  });

                  return (
                    <Marker 
                      key={eq.id} 
                      position={[lat, lng]} 
                      icon={singleIcon}
                      ticketCount={count}
                    >
                      <Popup>
                        <div style={{ fontFamily: 'Inter, sans-serif', minWidth: '240px' }}>
                          <h3 style={{ margin: '0 0 4px 0', fontSize: 14, color: 'var(--text)' }}>{eq.nome}</h3>
                          <p style={{ margin: '0 0 12px 0', fontSize: 12, fontWeight: 'bold', color: singleColor, borderBottom: '1px solid var(--border-c)', paddingBottom: '8px' }}>
                            {count} {count === 1 ? 'chamado registrado' : 'chamados registrados'}
                          </p>
                          
                          <div style={{ maxHeight: '160px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
                            {unitChamados.map((c, i) => (
                              <div key={i} style={{ background: 'var(--bg-c)', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-c)', fontSize: '11px' }}>
                                <strong style={{ display: 'block', color: 'var(--text)', marginBottom: '2px' }}>#{c.ticket} - {c.problema}</strong>
                                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted-c)' }}>
                                  <span>{c.responsavel || 'Sem atribuição'}</span>
                                  <span>{c.data_abertura ? new Date(c.data_abertura).toLocaleDateString('pt-BR') : '—'}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}
              </MarkerClusterGroup>
            ) : (
              dados.map(eq => {
                const isEditing = editingId === eq.id;
                
                // Usar lat/long real se existir, senão gera mock (ou a posição temporária de drag se estiver editando)
                const lat = isEditing && tempPos ? tempPos[0] : (eq.latitude || getMockCoords(eq)[0]);
                const lng = isEditing && tempPos ? tempPos[1] : (eq.longitude || getMockCoords(eq)[1]);
                
                return (
                  <Marker 
                    key={eq.id} 
                    position={[lat, lng]} 
                    icon={premiumIcon}
                    draggable={isEditing}
                    eventHandlers={{
                      dragend: (e) => {
                        const marker = e.target;
                        const position = marker.getLatLng();
                        setTempPos([position.lat, position.lng]);
                      },
                    }}
                    ref={(ref) => {
                      if (ref) markerRefs.current[eq.id] = ref;
                    }}
                  >
                    <Popup closeOnClick={!isEditing}>
                      <div style={{ fontFamily: 'Inter, sans-serif', minWidth: '220px' }}>
                        <h3 style={{ margin: '0 0 4px 0', fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                          {eq.codigo} - {eq.nome || 'Equipamento'}
                        </h3>
                        <p style={{ margin: '0 0 8px 0', fontSize: 12, color: 'var(--muted-c)' }}>
                          {eq.secretaria || 'Sem secretaria'}
                        </p>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 8px', fontSize: 11, marginBottom: 12 }}>
                          <strong style={{ color: 'var(--text)' }}>IP:</strong>
                          <span style={{ fontFamily: 'monospace' }}>{isVisitor ? '••••••••' : (eq.ip_equipamento || '—')}</span>
                          
                          <strong style={{ color: 'var(--text)' }}>Endereço:</strong>
                          <span>{eq.endereco || 'Não cadastrado'}</span>
                          
                          <strong style={{ color: 'var(--text)' }}>CEP:</strong>
                          <span>{eq.cep || '—'}</span>
                        </div>

                        {(!isVisitor && (isAdmin || isMaster)) && (
                          <div style={{ borderTop: '1px solid var(--border-c)', paddingTop: 10, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            {isEditing ? (
                              <>
                                <button 
                                  onClick={() => setEditingId(null)}
                                  style={{ flex: 1, padding: '6px 10px', fontSize: 11, background: 'transparent', border: '1px solid var(--border-c)', borderRadius: 4, cursor: 'pointer', color: 'var(--muted-c)' }}
                                >
                                  Cancelar
                                </button>
                                <button 
                                  onClick={() => handleEditSave(eq.id)}
                                  style={{ flex: 1, padding: '6px 10px', fontSize: 11, background: '#0D7C3D', border: 'none', borderRadius: 4, cursor: 'pointer', color: 'white', fontWeight: 600 }}
                                >
                                  Salvar Posição
                                </button>
                              </>
                            ) : (
                              <button 
                                onClick={() => handleEditStart(eq, lat, lng)}
                                style={{ width: '100%', padding: '6px 10px', fontSize: 11, background: 'var(--bg-c)', border: '1px solid var(--border-c)', borderRadius: 4, cursor: 'pointer', color: 'var(--text)', fontWeight: 500 }}
                              >
                                📍 Editar Localização
                              </button>
                            )}
                          </div>
                        )}
                        
                        {isEditing && (
                          <div style={{ fontSize: 10, color: '#0D7C3D', marginTop: 8, textAlign: 'center', background: 'rgba(13, 124, 61, 0.1)', padding: '6px 4px', borderRadius: 4, fontWeight: 500 }}>
                            Arraste este pino no mapa para ajustar.
                          </div>
                        )}
                      </div>
                    </Popup>
                  </Marker>
                );
              })
            )}
          </MapContainer>
        </div>
      </div>
    </div>
  );
}
