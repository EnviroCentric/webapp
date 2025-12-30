import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, FlatList, TouchableOpacity, TextInput, Button } from 'react-native';
import { useLocalSearchParams, Link } from 'expo-router';
import { request } from '@/lib/api';

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
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [addrLoading, setAddrLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addrError, setAddrError] = useState<string | null>(null);
  const [newAddressName, setNewAddressName] = useState('');

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
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  if (error || !project) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error ?? 'Project not found'}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{project.name}</Text>
      <Text style={styles.sub}>Created: {new Date(project.created_at).toLocaleDateString()}</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Today's Addresses</Text>
        {addrLoading && !addresses.length ? (
          <ActivityIndicator />
        ) : addrError ? (
          <Text style={styles.error}>{addrError}</Text>
        ) : !addresses.length ? (
          <Text>No addresses for today.</Text>
        ) : (
          <FlatList
            data={addresses}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => (
              <Link
                href={`/projects/${project.id}/addresses/${item.id}/samples`}
                asChild
              >
                <TouchableOpacity style={styles.card}>
                  <Text style={styles.addrName}>{item.name}</Text>
                  <Text style={styles.sub}>
                    Date: {new Date(item.date).toLocaleDateString()}
                  </Text>
                  <Text style={styles.linkText}>Collect samples</Text>
                </TouchableOpacity>
              </Link>
            )}
          />
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Add Address for Today</Text>
        <TextInput
          style={styles.input}
          placeholder="Address name"
          value={newAddressName}
          onChangeText={setNewAddressName}
        />
        <Button
          title={addrLoading ? 'Adding...' : 'Add Address'}
          onPress={handleAddAddress}
          disabled={addrLoading || !newAddressName.trim()}
        />
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
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  sub: {
    color: '#555',
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
    borderColor: '#ddd',
    marginBottom: 10,
    backgroundColor: '#fafafa',
  },
  addrName: {
    fontSize: 16,
    fontWeight: '600',
  },
  linkText: {
    marginTop: 4,
    color: '#1d4ed8',
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
