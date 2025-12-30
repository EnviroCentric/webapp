import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, FlatList, TouchableOpacity, TextInput, Button, SafeAreaView } from 'react-native';
import { useLocalSearchParams, Link, useRouter } from 'expo-router';
import { request } from '@/lib/api';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';

interface Address {
  id: number;
  name: string;
  date: string;
}

interface Project {
  id: number;
  name: string;
  created_at: string;
}

export default function ProjectDetailScreen() {
  const router = useRouter();
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [addrLoading, setAddrLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addrError, setAddrError] = useState<string | null>(null);
  const [newAddressName, setNewAddressName] = useState('');

  const backgroundColor = useThemeColor({}, 'background');
  const cardBackground = useThemeColor({}, 'card');
  const borderColor = useThemeColor({}, 'border');
  const textColor = useThemeColor({}, 'text');
  const subTextColor = useThemeColor({}, 'icon');
  const tintColor = useThemeColor({}, 'tint');

  useEffect(() => {
    if (!projectId) return;
    (async () => {
      try {
        const proj = await request<Project>({ path: `/api/v1/projects/${projectId}` });
        setProject(proj);
        await fetchTodayAddresses();
      } catch (e: any) {
        setError(e.message ?? 'Failed to load project');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const fetchTodayAddresses = async () => {
    if (!projectId) return;
    setAddrLoading(true);
    setAddrError(null);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const list = await request<Address[]>({
        path: `/api/v1/projects/${projectId}/addresses?date=${today}`,
      });
      setAddresses(list);
    } catch (e: any) {
      setAddrError(e.message ?? "Failed to load today's addresses");
    } finally {
      setAddrLoading(false);
    }
  };

  const handleAddAddress = async () => {
    if (!projectId || !newAddressName.trim()) return;
    setAddrLoading(true);
    setAddrError(null);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const created = await request<Address>({
        method: 'POST',
        path: `/api/v1/projects/${projectId}/addresses`,
        body: { name: newAddressName.trim(), date: today },
      });
      setNewAddressName('');
      // Refresh list including new address
      await fetchTodayAddresses();
    } catch (e: any) {
      setAddrError(e.message ?? 'Failed to add address');
    } finally {
      setAddrLoading(false);
    }
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

  if (error || !project) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.centered}>
          <ThemedText style={styles.error}>{error ?? 'Project not found'}</ThemedText>
        </ThemedView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ThemedView style={[styles.container, { backgroundColor }]}>
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ThemedText style={[styles.backLabel, { color: tintColor }]}>‹ Back</ThemedText>
        </TouchableOpacity>
      </View>
      <ThemedText style={[styles.title, { color: textColor }]}>{project.name}</ThemedText>
      <ThemedText style={[styles.sub, { color: subTextColor }]}>Created: {new Date(project.created_at).toLocaleDateString()}</ThemedText>

      <View style={styles.section}>
        <ThemedText style={[styles.sectionTitle, { color: textColor }]}>Today's Addresses</ThemedText>
        {addrLoading && !addresses.length ? (
          <ActivityIndicator />
        ) : addrError ? (
          <ThemedText style={styles.error}>{addrError}</ThemedText>
        ) : !addresses.length ? (
          <ThemedText>No addresses for today.</ThemedText>
        ) : (
          <FlatList
            data={addresses}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => (
              <Link
                href={`/projects/${project.id}/addresses/${item.id}/samples`}
                asChild
              >
                <TouchableOpacity
                  style={[
                    styles.card,
                    { backgroundColor: cardBackground, borderColor },
                  ]}
                >
                  <ThemedText style={[styles.addrName, { color: textColor }]}>
                    {item.name}
                  </ThemedText>
                  <ThemedText style={[styles.sub, { color: subTextColor }]}>
                    Date: {new Date(item.date).toLocaleDateString()}
                  </ThemedText>
                  <ThemedText style={[styles.linkText, { color: tintColor }]}>Collect samples</ThemedText>
                </TouchableOpacity>
              </Link>
            )}
          />
        )}
      </View>

      <View style={styles.section}>
        <ThemedText style={[styles.sectionTitle, { color: textColor }]}>Add Address for Today</ThemedText>
        <TextInput
          style={[
            styles.input,
            { borderColor, color: textColor, backgroundColor: cardBackground },
          ]}
          placeholder="Address name"
          placeholderTextColor={subTextColor}
          value={newAddressName}
          onChangeText={setNewAddressName}
        />
        <Button
          title={addrLoading ? 'Adding...' : 'Add Address'}
          onPress={handleAddAddress}
          disabled={addrLoading || !newAddressName.trim()}
          color={tintColor}
        />
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  backButton: {
    paddingVertical: 4,
    paddingRight: 12,
  },
  backLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  sub: {
    marginBottom: 16,
  },
  section: {
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  card: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 10,
  },
  addrName: {
    fontSize: 16,
    fontWeight: '600',
  },
  linkText: {
    marginTop: 4,
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
