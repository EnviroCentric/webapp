import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, FlatList, TouchableOpacity, TextInput, Button, SafeAreaView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { request } from '@/lib/api';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';

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

  const backgroundColor = useThemeColor({}, 'background');
  const cardBackground = useThemeColor({}, 'card');
  const borderColor = useThemeColor({}, 'border');
  const textColor = useThemeColor({}, 'text');
  const subTextColor = useThemeColor({}, 'icon');
  const tintColor = useThemeColor({}, 'tint');

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
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.centered}>
          <ActivityIndicator />
        </ThemedView>
      </SafeAreaView>
    );
  }

  if (error || !address) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.centered}>
          <ThemedText style={styles.error}>{error ?? 'Address not found'}</ThemedText>
        </ThemedView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ThemedView style={[styles.container, { backgroundColor }]}>
      <View style={styles.header}>
        <ThemedText style={[styles.title, { color: textColor }]}>{address.name}</ThemedText>
        <ThemedText style={[styles.sub, { color: subTextColor }]}>
          {new Date(address.date).toLocaleDateString()}
        </ThemedText>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <ThemedText style={[styles.sectionTitle, { color: textColor }]}>Samples for Today</ThemedText>
          <Button title="Refresh" onPress={fetchSamples} />
        </View>
        {samples.length === 0 ? (
          <ThemedText>No samples for today.</ThemedText>
        ) : (
          <FlatList
            data={samples}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => {
              const secs = totalSeconds(item);
              return (
                <ThemedView style={[styles.sampleCard, { backgroundColor: cardBackground, borderColor }]}>
                  <ThemedText style={[styles.sampleDesc, { color: textColor }]}>{item.description}</ThemedText>
                  <ThemedText style={[styles.sub, { color: subTextColor }]}>Start: {formatTime(item.start_time)}</ThemedText>
                  <ThemedText style={[styles.sub, { color: subTextColor }]}>End: {formatTime(item.stop_time)}</ThemedText>
                  <ThemedText style={[styles.sub, { color: subTextColor }]}>Total: {formatDuration(secs)}</ThemedText>
                  <View style={styles.buttonRow}>
                    {!item.start_time && (
                      <TouchableOpacity onPress={() => handleStart(item)} style={[styles.btn, { backgroundColor: tintColor }]}>
                        <ThemedText style={styles.btnText}>Start</ThemedText>
                      </TouchableOpacity>
                    )}
                    {item.start_time && !item.stop_time && (
                      <TouchableOpacity onPress={() => handleStop(item)} style={[styles.btnWarn, { backgroundColor: '#f59e0b' }]}>
                        <ThemedText style={styles.btnText}>Stop</ThemedText>
                      </TouchableOpacity>
                    )}
                    {item.start_time && item.stop_time && (
                      <TouchableOpacity onPress={() => handleResume(item)} style={[styles.btn, { backgroundColor: tintColor }]}>
                        <ThemedText style={styles.btnText}>Resume</ThemedText>
                      </TouchableOpacity>
                    )}
                    {(item.start_time || item.stop_time) && (
                      <TouchableOpacity onPress={() => handleReset(item)} style={[styles.btnDanger, { backgroundColor: '#dc2626' }]}>
                        <ThemedText style={styles.btnText}>Reset</ThemedText>
                      </TouchableOpacity>
                    )}
                  </View>
                </ThemedView>
              );
            }}
          />
        )}
      </View>

      <View style={styles.section}>
        <ThemedText style={[styles.sectionTitle, { color: textColor }]}>Add Sample</ThemedText>
        {addError && <ThemedText style={styles.error}>{addError}</ThemedText>}
        {adding ? (
          <>
            <TextInput
              style={[
                styles.input,
                { borderColor, color: textColor, backgroundColor: cardBackground },
              ]}
              placeholder="Sample description"
              placeholderTextColor={subTextColor}
              value={newDesc}
              onChangeText={setNewDesc}
            />
            <Button
              title={saving ? 'Saving...' : 'Save Sample'}
              onPress={handleAddSample}
              disabled={saving || !newDesc.trim()}
              color={tintColor}
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
          <Button title="Add Sample" onPress={() => setAdding(true)} color={tintColor} />
        )}
      </View>
    </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    padding: 16,
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
  sub: {},
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
    marginBottom: 10,
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
  },
  btnWarn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
  },
  btnDanger: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
  },
  btnText: {
    color: '#fff',
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
  },
  error: {},
});
