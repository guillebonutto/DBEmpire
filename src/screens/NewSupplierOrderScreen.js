import React, { useState, useEffect, useRef, memo, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ScrollView, ActivityIndicator, LayoutAnimation, Platform, UIManager } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFinanceStore } from '../store/useFinanceStore';
import { useProductStore } from '../store/useProductStore';
import { useSupplierStore } from '../store/useSupplierStore';

import DateTimePicker from '@react-native-community/datetimepicker';

export default function NewSupplierOrderScreen({ navigation, route }) {
    const { addSupplierOrderLocal, updateSupplierOrderLocal, setFinanceState, supplierOrders: orders, fetchAllData } = useFinanceStore();
    const { products, fetchProducts } = useProductStore();
    const { suppliers, fetchSuppliers } = useSupplierStore();

    const [purchaseDate, setPurchaseDate] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [provider, setProvider] = useState('');
    const [tracking, setTracking] = useState('');
    const [itemsDesc, setItemsDesc] = useState('');
    const [cost, setCost] = useState('');
    const [discount, setDiscount] = useState('0');
    const [installmentsTotal, setInstallmentsTotal] = useState('1');
    const [installmentsPaid, setInstallmentsPaid] = useState('0');
    const [courier, setCourier] = useState(''); // Andreani, OCA, Via Cargo
    const [loading, setLoading] = useState(false);
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    const [isConsignment, setIsConsignment] = useState(false);

    // Supplier State
    const [showSupplierModal, setShowSupplierModal] = useState(false);
    const [supplierSearch, setSupplierSearch] = useState('');
    const [selectedSupplierId, setSelectedSupplierId] = useState(null);
    const [activeSupplierItemIndex, setActiveSupplierItemIndex] = useState(null);

    useFocusEffect(
        useCallback(() => {
            fetchSuppliers();
            fetchProducts();
        }, [])
    );

    // Product Linking State
    const [selectedProducts, setSelectedProducts] = useState([]); // { product, quantity, cost, isNew, tempName }
    const [showProductModal, setShowProductModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedIndex, setExpandedIndex] = useState(null);
    const inputRefs = useRef([]);

    const toggleExpand = useCallback((index) => {
        LayoutAnimation.configureNext({
            duration: 150,
            update: { type: LayoutAnimation.Types.easeInEaseOut },
            create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity }
        });
        setExpandedIndex(prev => prev === index ? null : index);
    }, []);

    React.useEffect(() => {
        if (route.params?.orderToEdit) {
            const order = route.params.orderToEdit;
            setProvider(order.provider_name);
            setTracking(order.tracking_number || '');
            setItemsDesc(order.items_description || '');
            setCost(order.total_cost?.toString() || '');
            setDiscount(order.discount?.toString() || '0');
            setInstallmentsTotal(order.installments_total?.toString() || '1');
            setInstallmentsPaid(order.installments_paid?.toString() || '0');
            setCourier(order.notes || '');
            if (order.created_at) {
                setPurchaseDate(new Date(order.created_at));
            }

            if (order.supplier_id) {
                setSelectedSupplierId(order.supplier_id);
            } else if (suppliers && order.provider_name) {
                const match = suppliers.find(s => s.name === order.provider_name);
                if (match) setSelectedSupplierId(match.id);
            }

            if (order.status === 'consigned') {
                setIsConsignment(true);
            }

            loadLinkedItems(order.id);
        }
    }, [route.params?.orderToEdit, suppliers]);

    const loadLinkedItems = async (orderId) => {
        try {
            const { data, error } = await supabase
                .from('supplier_order_items')
                .select('*, products(id, name, current_stock)')
                .eq('supplier_order_id', orderId);

            if (error) throw error;

            if (data && data.length > 0) {
                const groupedMap = {};

                data.forEach(item => {
                    const costVal = item.cost_per_unit || 0;
                    const qtyVal = item.quantity || 1;
                    const prodName = item.products?.name || item.temp_product_name || 'Producto Desconocido';

                    const key = item.product_id ? `prod_${item.product_id}_${costVal}` : `new_${item.temp_product_name}_${costVal}`;

                    if (!groupedMap[key]) {
                        groupedMap[key] = {
                            product: item.products || { id: item.product_id, name: prodName },
                            cost: costVal.toString(),
                            variants: [],
                            isNew: !item.product_id,
                            tempName: item.temp_product_name,
                            localId: Math.random().toString(36).substr(2, 9),
                            supplierName: item.supplier || ''
                        };
                    }

                    groupedMap[key].variants.push({
                        color: item.color || '',
                        quantity: qtyVal.toString()
                    });
                });

                setSelectedProducts(Object.values(groupedMap));
            } else {
                setSelectedProducts([]);
            }

            setTimeout(() => setIsInitialLoad(false), 300);

        } catch (err) {
            console.error('Error loading items:', err);
            setIsInitialLoad(false);
        }
    };

    const selectSupplier = (s) => {
        if (activeSupplierItemIndex !== null) {
            setSelectedProducts(prev => {
                const updated = [...prev];
                updated[activeSupplierItemIndex] = {
                    ...updated[activeSupplierItemIndex],
                    supplierId: s.id,
                    supplierName: s.name
                };
                return updated;
            });
            setActiveSupplierItemIndex(null);
        } else {
            setProvider(s.name);
            setSelectedSupplierId(s.id);
        }
        setShowSupplierModal(false);
        setSupplierSearch('');
    };

    // Rest of the component logic (UI, save, etc.) would follow, 
    // ensuring fetchProducts and fetchSuppliers use the local stores.
    // (Truncated for brevity, focusing on the requested changes)
}
