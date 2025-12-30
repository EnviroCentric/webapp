import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, FlatList, TouchableOpacity, TextInput, Button } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { request } from '@/lib/api';

interface Address {
  id: number;
  name: string;
  date: string;
}

interface Sample {
  id: number;
  description: string;
  cassette_barcode: string;
  start_time?: string | null;
  stop_time?: string | null;
}

export default function SampleCollectionScreen() {
  const { projectId, addressId } = useLocalSearchParams<{ projectId: string; addressId: string }>();
  const [address, setAddress] = useState<Address | null>(null);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [adding, setAdding] = useState(false);
  const [newDesc, setNewDesc] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!projectId || !addressId) return;
    (async () => {
      try {
        const addr = await request<Address>({
          path: `/api/v1/projects/${projectId}/addresses/${addressId}`,
        });
        setAddress(addr);
        await fetchSamples();
      } catch (e: any) {
        setError(e.message ?? 'Failed to load address or samples');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, addressId]);

  const fetchSamples = async () => {
    if (!addressId) return;
    const today = new Date().toISOString().slice(0, 10);
    const list = await request<Sample[]>({
      path: `/api/v1/samples/address/${addressId}?date=${today}`,
    });
    setSamples(list);
  };

  const formatTime = (iso?: string | null) => {
    if (!iso) return '--:--';
    return new Date(iso).toLocaleTimeString();
  };

  const totalSeconds = (s: Sample): number => {
    if (!s.start_time) return 0;
    const start = new Date(s.start_time).getTime();
    const end = s.stop_time ? new Date(s.stop_time).getTime() : start;
    if (end <= start) return 0;
    return Math.floor((end - start) / 1000);
  };

  const formatDuration = (secs: number) => {
    const h = Math.floor(secs / 3600)
      .toString()
      .padStart(2, '0');
    const m = Math.floor((secs % 3600) / 60)
      .toString()
      .padStart(2, '0');
    const s = Math.floor(secs % 60)
      .toString()
      .padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const generateBarcode = () => {
    return 'BC-' + Math.random().toString(36).substring(2, 10).toUpperCase();
  };

  const handleAddSample = async () => {
    if (!addressId || !newDesc.trim()) return;
    setSaving(true);
    setAddError(null);
    try {
      await request<Sample>({
        method: 'POST',
        path: '/api/v1/samples/',
        body: {
          address_id: Number(addressId),
          description: newDesc.trim(),
          cassette_barcode: generateBarcode(),
          flow_rate: 12,
          volume_required: 1000,
        },
      });
      setNewDesc('');
      setAdding(false);
      await fetchSamples();
    } catch (e: any) {
      setAddError(e.message ?? 'Failed to add sample');
    } finally {
      setSaving(false);
    }
  };

  const patchSample = async (id: number, body: Record<string, any>) => {
    const updated = await request<Sample>({
      method: 'PATCH',
      path: `/api/v1/samples/${id}`,
      body,
    });
    setSamples((prev) => prev.map((s) => (s.id === id ? updated : s)));
  };

  const handleStart = (sample: Sample) => {
    if (sample.start_time) return;
    const now = new Date().toISOString();
    patchSample(sample.id, { start_time: now, stop_time: null });
  };

  const handleStop = (sample: Sample) => {
    if (!sample.start_time || sample.stop_time) return;
    const now = new Date().toISOString();
    patchSample(sample.id, { stop_time: now });
  };

  const handleResume = (sample: Sample) => {
    if (!sample.start_time || !sample.stop_time) return;
    patchSample(sample.id, { stop_time: null });
  };

  const handleReset = (sample: Sample) => {
    patchSample(sample.id, { start_time: null, stop_time: null });
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  if (error || !address) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error ?? 'Address not found'}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{address.name}</Text>
        <Text style={styles.sub}>{new Date(address.date).toLocaleDateString()}</Text>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Samples for Today</Text>
          <Button title="Refresh" onPress={fetchSamples} />
        </View>
        {samples.length === 0 ? (
          <Text>No samples for today.</Text>
        ) : (
          <FlatList
            data={samples}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => {
              const secs = totalSeconds(item);
              return (
                <View style={styles.sampleCard}>
                  <Text style={styles.sampleDesc}>{item.description}</Text>
                  <Text style={styles.sub}>Start: {formatTime(item.start_time)}</Text>
                  <Text style={styles.sub}>End: {formatTime(item.stop_time)}</Text>
                  <Text style={styles.sub}>Total: {formatDuration(secs)}</Text>
                  <View style={styles.buttonRow}>
                    {!item.start_time && (
                      <TouchableOpacity onPress={() => handleStart(item)} style={styles.btn}>
                        <Text style={styles.btnText}>Start</Text>
                      </TouchableOpacity>
                    )}
                    {item.start_time && !item.stop_time && (
                      <TouchableOpacity onPress={() => handleStop(item)} style={styles.btnWarn}>
                        <Text style={styles.btnText}>Stop</Text>
                      </TouchableOpacity>
                    )}
                    {item.start_time && item.stop_time && (
                      <TouchableOpacity onPress={() => handleResume(item)} style={styles.btn}>
                        <Text style={styles.btnText}>Resume</Text>
                      </TouchableOpacity>
                    )}
                    {(item.start_time || item.stop_time) && (
                      <TouchableOpacity onPress={() => handleReset(item)} style={styles.btnDanger}>
                        <Text style={styles.btnText}>Reset</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            }}
          />
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Add Sample</Text>
        {addError && <Text style={styles.error}>{addError}</Text>}
        {adding ? (
          <>
            <TextInput
              style={styles.input}
              placeholder="Sample description"
              value={newDesc}
              onChangeText={setNewDesc}
            />
            <Button
              title={saving ? 'Saving...' : 'Save Sample'}
              onPress={handleAddSample}
              disabled={saving || !newDesc.trim()}
            />
            <View style={{ height: 8 }} />
            <Button
              title="Cancel"
              color="#6b7280"
              onPress={() => {
                setAdding(false);
                setNewDesc('');
              }}
            />
          </>
        ) : (
          <Button title="Add Sample" onPress={() => setAdding(true)} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  sub: {
    color: '#555',
  },
  section: {
    marginTop: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  sampleCard: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    marginBottom: 10,
    backgroundColor: '#f9fafb',
  },
  sampleDesc: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    marginTop: 8,
    flexWrap: 'wrap',
    gap: 8,
  },
  btn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: '#2563eb',
  },
  btnWarn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: '#f59e0b',
  },
  btnDanger: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: '#dc2626',
  },
  btnText: {
    color: '#fff',
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
  },
  error: {
    color: 'red',
  },
});
