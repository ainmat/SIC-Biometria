import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import TopbarAvatar from '@/components/layout/TopbarAvatar';
import { supabase, fetchEquipamentos, fetchChamados } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import MarkerClusterGroup from 'react-leaflet-cluster';
import { Network, MapPin } from 'lucide-react';

// Ícone premium (Pino Estilo Card Airbnb com o Coletor Gigante)
const premiumIcon = new L.divIcon({
  className: 'custom-div-icon',
  html: `
    <div style="position: relative; display: flex; flex-direction: column; align-items: center; width: 48px; height: 60px;">
      <!-- Sombra da base -->
      <div style="position: absolute; bottom: -2px; width: 20px; height: 6px; background: rgba(0,0,0,0.5); border-radius: 50%; filter: blur(3px);"></div>
      <!-- Card Branco do Coletor -->
      <div style="width: 44px; height: 50px; background: white; border: 2.5px solid #0D7C3D; border-radius: 12px; box-shadow: 0 4px 10px rgba(0,0,0,0.2); display: flex; align-items: center; justify-content: center; z-index: 2; overflow: hidden; position: relative;">
         <!-- Fundo em degradê para dar destaque à maquininha preta -->
         <div style="position: absolute; inset: 0; background: radial-gradient(circle, #ffffff 0%, #e2e8f0 100%);"></div>
         <!-- Imagem do Coletor (Aumentada em 3x) -->
         <img src="/Coletor.png" style="width: 32px; height: 42px; object-fit: contain; z-index: 1; filter: drop-shadow(0 3px 4px rgba(0,0,0,0.3));" />
      </div>
      <!-- Triângulo apontador do Pino -->
      <div style="width: 0; height: 0; border-left: 8px solid transparent; border-right: 8px solid transparent; border-top: 10px solid #0D7C3D; margin-top: -2px; z-index: 1;"></div>
    </div>
  `,
  iconSize: [48, 60],
  iconAnchor: [24, 60],
  popupAnchor: [0, -60],
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
                {(() => {
                  const markers = [];
                  let mockIdCounter = 10000;
                  
                  for (const [unitKey, tickets] of Object.entries(unitTickets)) {
                    const eq = dados.find(e => {
                      const n = normalize(e.nome);
                      return n.includes(unitKey) || unitKey.includes(n);
                    });
                    
                    let lat, lng, title, id;
                    
                    if (eq) {
                      lat = eq.latitude || getMockCoords(eq)[0];
                      lng = eq.longitude || getMockCoords(eq)[1];
                      title = tickets[0]?.unidade || eq.nome;
                      id = `unit-eq-${eq.id}-${unitKey}`;
                    } else {
                      mockIdCounter++;
                      const mockEq = { nome: tickets[0]?.unidade || unitKey, id: mockIdCounter };
                      lat = getMockCoords(mockEq)[0];
                      lng = getMockCoords(mockEq)[1];
                      title = tickets[0]?.unidade || unitKey;
                      id = `unit-mock-${mockIdCounter}`;
                    }
                    
                    markers.push({
                      id,
                      lat,
                      lng,
                      title,
                      tickets,
                      count: tickets.length
                    });
                  }
                  
                  return markers.map(marker => {
                    let singleColor = '#0D7C3D';
                    if (marker.count > 10) singleColor = '#f5a623';
                    if (marker.count > 40) singleColor = '#ff4d4f';

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
                          <div style={{ fontFamily: 'Inter, sans-serif', minWidth: '240px' }}>
                            <h3 style={{ margin: '0 0 4px 0', fontSize: 14, color: 'var(--text)' }}>{marker.title}</h3>
                            <p style={{ margin: '0 0 12px 0', fontSize: 12, fontWeight: 'bold', color: singleColor, borderBottom: '1px solid var(--border-c)', paddingBottom: '8px' }}>
                              {marker.count} {marker.count === 1 ? 'chamado registrado' : 'chamados registrados'}
                            </p>
                            
                            <div style={{ maxHeight: '160px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
                              {marker.tickets.map((c, i) => (
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
                  });
                })()}
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
