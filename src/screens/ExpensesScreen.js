import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, Alert, ActivityIndicator, StatusBar, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../services/supabase';
import { useFocusEffect } from '@react-navigation/native';
// import { Ionicons } from '@expo/vector-icons'; // Unused, removing to prevent issues

const EXPENSE_CATEGORIES = ['General', 'Rent', 'Utilities', 'Marketing', 'Inventory', 'Salaries', 'Other'];

export default function ExpensesScreen({ navigation }) {
    const [expenses, setExpenses] = useState([]);
    const [loading, setLoading] = useState(false);
    const [adding, setAdding] = useState(false);

    // Form State
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState('General');

    const fetchExpenses = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('expenses')
                .select('*')
                .order('date', { ascending: false })
                .limit(50);

            if (error) throw error;
            setExpenses(data || []);
        } catch (error) {
            console.log('Error fetching expenses:', error.message);
            // Alert.alert('Error', 'Could not fetch expenses.');
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchExpenses();
        }, [])
    );

    const handleAddExpense = async () => {
        if (!description || !amount) {
            Alert.alert('Error', 'Description and Amount are required.');
            return;
        }

        setAdding(true);
        try {
            const { error } = await supabase
                .from('expenses')
                .insert([{
                    description,
                    amount: parseFloat(amount),
                    category,
                    date: new Date().toISOString()
                }]);

            if (error) throw error;

            Alert.alert('Success', 'Expense registered.');
            setDescription('');
            setAmount('');
            setCategory('General');
            fetchExpenses(); // Refresh list
        } catch (error) {
            console.log('Error adding expense:', error);
            Alert.alert('Error', 'Could not save expense.');
        } finally {
            setAdding(false);
        }
    };

    const handleDelete = async (id) => {
        Alert.alert(
            'Confirm Delete',
            'Are you sure you want to delete this expense?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const { error } = await supabase.from('expenses').delete().eq('id', id);
                            if (error) throw error;
                            fetchExpenses();
                        } catch (err) {
                            Alert.alert('Error', 'Could not delete expense');
                        }
                    }
                }
            ]
        );
    };

    const renderItem = ({ item }) => (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <Text style={styles.categoryBadge}>{item.category}</Text>
                <Text style={styles.dateText}>{new Date(item.date).toLocaleDateString()}</Text>
            </View>
            <View style={styles.cardBody}>
                <Text style={styles.description}>{item.description}</Text>
                <Text style={styles.amount}>- ${parseFloat(item.amount).toFixed(2)}</Text>
            </View>
            <TouchableOpacity style={styles.deleteButton} onPress={() => handleDelete(item.id)}>
                <Text style={styles.deleteText}>Delete</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="light-content" />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Text style={styles.backButtonText}>← Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>EXPENSES</Text>
            </View>

            <View style={styles.formContainer}>
                <Text style={styles.sectionTitle}>New Expense</Text>
                <TextInput
                    style={styles.input}
                    placeholder="Description (e.g. Internet Bill)"
                    placeholderTextColor="#666"
                    value={description}
                    onChangeText={setDescription}
                />
                <View style={styles.row}>
                    <TextInput
                        style={[styles.input, { flex: 1, marginRight: 10 }]}
                        placeholder="Amount ($)"
                        placeholderTextColor="#666"
                        keyboardType="numeric"
                        value={amount}
                        onChangeText={setAmount}
                    />
                    {/* Simple Category Selector for now */}
                    <TouchableOpacity style={styles.categorySelector}>
                        <Text style={styles.categoryText}>{category}</Text>
                    </TouchableOpacity>
                </View>
                {/* Category Pills */}
                <View style={styles.categoryList}>
                    {EXPENSE_CATEGORIES.map(cat => (
                        <TouchableOpacity
                            key={cat}
                            style={[styles.catPill, category === cat && styles.catPillActive]}
                            onPress={() => setCategory(cat)}
                        >
                            <Text style={[styles.catPillText, category === cat && styles.catPillTextActive]}>{cat}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <TouchableOpacity
                    style={styles.addButton}
                    onPress={handleAddExpense}
                    disabled={adding}
                >
                    {adding ? <ActivityIndicator color="#000" /> : <Text style={styles.addButtonText}>ADD EXPENSE</Text>}
                </TouchableOpacity>
            </View>

            <FlatList
                data={expenses}
                keyExtractor={item => item.id}
                renderItem={renderItem}
                contentContainerStyle={styles.listContent}
                ListHeaderComponent={<Text style={styles.listTitle}>Recent History</Text>}
                refreshControl={
                    <RefreshControl refreshing={loading} onRefresh={fetchExpenses} tintColor="#d4af37" colors={['#d4af37']} />
                }
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000000' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        backgroundColor: '#1a1a1a',
        borderBottomWidth: 1,
        borderBottomColor: '#333',
    },
    backButton: { marginRight: 15 },
    backButtonText: { color: '#d4af37', fontSize: 16 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#d4af37' },

    formContainer: {
        padding: 15,
        backgroundColor: '#111',
        borderBottomWidth: 1,
        borderBottomColor: '#333'
    },
    sectionTitle: { color: '#fff', fontSize: 16, marginBottom: 10, fontWeight: '600' },
    input: {
        backgroundColor: '#222',
        color: '#fff',
        padding: 12,
        borderRadius: 8,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#444'
    },
    row: { flexDirection: 'row', alignItems: 'center' },
    categoryList: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 15 },
    catPill: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        backgroundColor: '#333',
        marginRight: 8,
        marginBottom: 8
    },
    catPillActive: { backgroundColor: '#d4af37' },
    catPillText: { color: '#aaa', fontSize: 12 },
    catPillTextActive: { color: '#000', fontWeight: 'bold' },

    addButton: {
        backgroundColor: '#d4af37',
        padding: 15,
        borderRadius: 8,
        alignItems: 'center',
    },
    addButtonText: { color: '#000', fontWeight: 'bold', fontSize: 16 },

    // Missing styles added
    categorySelector: {
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 15,
        backgroundColor: '#333',
        borderRadius: 8,
        height: 50 // Match input height roughly
    },
    categoryText: {
        color: '#d4af37',
        fontWeight: 'bold',
        fontSize: 14
    },

    listContent: { padding: 15 },
    listTitle: { color: '#888', marginBottom: 10, fontSize: 14, textTransform: 'uppercase' },

    card: {
        backgroundColor: '#1e1e1e',
        borderRadius: 10,
        padding: 15,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#333'
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
    categoryBadge: { color: '#d4af37', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase' },
    dateText: { color: '#666', fontSize: 12 },
    cardBody: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    description: { color: '#fff', fontSize: 16, fontWeight: '500' },
    amount: { color: '#e74c3c', fontSize: 18, fontWeight: 'bold' },
    deleteButton: { marginTop: 10, alignSelf: 'flex-end' },
    deleteText: { color: '#555', fontSize: 12 }
});
