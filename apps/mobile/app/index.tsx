import { useEffect, useState } from "react";
import { FlatList, StyleSheet, Text, TextInput, View } from "react-native";
import Constants from "expo-constants";

const API_URL = (Constants.expoConfig?.extra?.apiUrl as string) ?? "http://localhost:3001";

type Product = {
  id: string;
  name: string;
  salePrice: string;
  stockItems: { quantity: string }[];
};

// Pantalla principal: buscador de productos con stock (misma API que el web).
export default function Home() {
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    const url = new URL(`${API_URL}/api/products`);
    if (search) url.searchParams.set("search", search);
    fetch(url.toString())
      .then((r) => r.json())
      .then((data) => setProducts(data.items ?? []))
      .catch(() => setProducts([]));
  }, [search]);

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="Buscar producto o SKU…"
        value={search}
        onChangeText={setSearch}
      />
      <FlatList
        data={products}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => {
          const stock = item.stockItems.reduce((s, i) => s + Number(i.quantity), 0);
          return (
            <View style={styles.row}>
              <Text style={styles.name}>{item.name}</Text>
              <Text>
                ${Number(item.salePrice).toLocaleString("es-AR")} · Stock: {stock}
              </Text>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12, marginBottom: 12 },
  row: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#eee" },
  name: { fontWeight: "600", fontSize: 16 },
});
