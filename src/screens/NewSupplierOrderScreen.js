import React, { useState, useEffect, useRef, memo, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ScrollView, ActivityIndicator, LayoutAnimation, Platform, UIManager } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

import DateTimePicker from '@react-native-community/datetimepicker';

export default function NewSupplierOrderScreen({ navigation, route }) {
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

    // Supplier State
    const [suppliersList, setSuppliersList] = useState([]);
    const [showSupplierModal, setShowSupplierModal] = useState(false);
    const [supplierSearch, setSupplierSearch] = useState('');
    const [selectedSupplierId, setSelectedSupplierId] = useState(null);
    const [activeSupplierItemIndex, setActiveSupplierItemIndex] = useState(null);

    useFocusEffect(
        useCallback(() => {
            fetchSuppliers();
        }, [])
    );

    // Product Linking State
    const [products, setProducts] = useState([]);
    const [selectedProducts, setSelectedProducts] = useState([]); // { product, quantity, cost, isNew, tempName }
    const [showProductModal, setShowProductModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedIndex, setExpandedIndex] = useState(null);
    const inputRefs = useRef([]);

    const toggleExpand = useCallback((index) => {
        // Linear is often perceived as faster for initial movement
        LayoutAnimation.configureNext({
            duration: 150,
            update: { type: LayoutAnimation.Types.easeInEaseOut },
            create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity }
        });
        setExpandedIndex(prev => prev === index ? null : index);
    }, []);

    React.useEffect(() => {
        fetchProducts();
        fetchSuppliers();
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

            // Allow editing status from here too if needed, or keep it simple
            loadLinkedItems(order.id);
        }
    }, [route.params?.orderToEdit]);

    const loadLinkedItems = async (orderId) => {
        const { data, error } = await supabase
            .from('supplier_order_items')
            .select('product_id, quantity, cost_per_unit, temp_product_name, supplier, color, products(id, name, current_stock)')
            .eq('supplier_order_id', orderId);

        if (data) {
            // Group items by product and cost
            const groupedMap = {};
            data.forEach(item => {
                const key = item.product_id ? `prod_${item.product_id}_${item.cost_per_unit}` : `new_${item.temp_product_name}_${item.cost_per_unit}`;
                if (!groupedMap[key]) {
                    groupedMap[key] = {
                        product: item.products || { id: null, name: item.temp_product_name },
                        cost: item.cost_per_unit.toString(),
                        variants: [],
                        isNew: !item.product_id,
                        tempName: item.temp_product_name,
                        localId: Math.random().toString(36).substr(2, 9)
                    };
                }
                groupedMap[key].variants.push({
                    color: item.color || '',
                    quantity: item.quantity.toString()
                });
            });

            setSelectedProducts(Object.values(groupedMap));
            setTimeout(() => setIsInitialLoad(false), 500);
        } else {
            setIsInitialLoad(false);
        }
    };

    const fetchProducts = async () => {
        const { data } = await supabase.from('products').select('*').eq('active', true);
        if (data) setProducts(data);
    };

    const fetchSuppliers = async () => {
        const { data } = await supabase.from('suppliers').select('*').eq('active', true).order('name', { ascending: true });
        if (data) setSuppliersList(data);
    };

    const openSupplierForProduct = (index) => {
        setActiveSupplierItemIndex(index);
        setShowSupplierModal(true);
    };

    const selectSupplier = (s) => {
        if (activeSupplierItemIndex !== null) {
            // Updating a specific item's official supplier
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
            // Updating the overall Store/Business name
            setProvider(s.name);
            setSelectedSupplierId(s.id);
        }
        setShowSupplierModal(false);
        setSupplierSearch('');
    };

    // Auto-calculate Total Cost based on Products (only if not initial load or manual override)
    useEffect(() => {
        if (isInitialLoad && route.params?.orderToEdit) {
            return;
        }

        const total = selectedProducts.reduce((sum, item) => {
            const unitCost = parseFloat(item.cost) || 0;
            const itemQty = item.variants.reduce((vSum, v) => vSum + (parseFloat(v.quantity) || 0), 0);
            return sum + (itemQty * unitCost);
        }, 0);

        if (total > 0) {
            setCost(total.toFixed(2));
        }
    }, [selectedProducts]);

    const addProductToOrder = (product, isNew = false, tempName = '') => {
        const newProduct = {
            product: isNew ? { id: null, name: tempName } : product,
            cost: isNew ? '0' : (product.cost_price?.toString() || '0'),
            variants: [{ color: '', quantity: '1' }],
            isNew,
            tempName: isNew ? tempName : null,
            localId: Math.random().toString(36).substr(2, 9),
            quality: 'perfect',
            supplierId: null, // Start empty, don't inherit 'Store'
            supplierName: ''  // Start empty
        };

        const newIndex = selectedProducts.length;
        setSelectedProducts([...selectedProducts, newProduct]);
        setShowProductModal(false);
        setSearchQuery('');

        // Expand the new item and focus its cost input
        LayoutAnimation.configureNext({
            duration: 200,
            update: { type: LayoutAnimation.Types.easeInEaseOut }
        });
        setExpandedIndex(newIndex);

        // Short timeout to ensure input is rendered before focusing
        setTimeout(() => {
            if (inputRefs.current[newIndex]) {
                inputRefs.current[newIndex].focus();
            }
        }, 80);
    };

    const updateProductItem = useCallback((index, field, value) => {
        setSelectedProducts(prev => {
            const updated = [...prev];
            if (field === 'name') {
                updated[index] = {
                    ...updated[index],
                    product: { ...updated[index].product, name: value },
                    tempName: updated[index].isNew ? value : updated[index].tempName
                };
            } else {
                updated[index] = { ...updated[index], [field]: value };
            }
            return updated;
        });
    }, []);

    const addVariantToProduct = useCallback((index) => {
        setSelectedProducts(prev => {
            const updated = [...prev];
            const newItem = { ...updated[index] };
            newItem.variants = [...newItem.variants, { color: '', quantity: '1' }];
            updated[index] = newItem;
            return updated;
        });
    }, []);

    const updateVariant = useCallback((pIdx, vIdx, field, value) => {
        setSelectedProducts(prev => {
            const updated = [...prev];
            const newItem = { ...updated[pIdx] };
            const newVariants = [...newItem.variants];
            newVariants[vIdx] = { ...newVariants[vIdx], [field]: value };
            newItem.variants = newVariants;
            updated[pIdx] = newItem;
            return updated;
        });
    }, []);

    const removeVariant = useCallback((pIdx, vIdx) => {
        setSelectedProducts(prev => {
            const updated = [...prev];
            const newItem = { ...updated[pIdx] };
            const newVariants = newItem.variants.filter((_, i) => i !== vIdx);

            if (newVariants.length === 0) {
                return prev.filter((_, i) => i !== pIdx);
            }

            newItem.variants = newVariants;
            updated[pIdx] = newItem;
            return updated;
        });
    }, []);

    const removeProductItem = useCallback((index) => {
        setSelectedProducts(prev => prev.filter((_, i) => i !== index));
    }, []);

    const handleSave = async () => {
        if (!provider) {
            Alert.alert('Error', 'El nombre del proveedor es obligatorio.');
            return;
        }

        setLoading(true);
        try {
            const payload = {
                provider_name: provider,
                tracking_number: tracking || null,
                items_description: itemsDesc,
                total_cost: parseFloat(cost) || 0,
                discount: parseFloat(discount) || 0,
                installments_total: parseInt(installmentsTotal) || 1,
                installments_paid: parseInt(installmentsPaid) || 0,
                notes: courier,
                created_at: purchaseDate.toISOString(),
                supplier_id: selectedSupplierId
            };

            let orderId;

            if (route.params?.orderToEdit) {
                // UPDATE
                orderId = route.params.orderToEdit.id;
                const { error } = await supabase
                    .from('supplier_orders')
                    .update(payload)
                    .eq('id', orderId);

                if (error) throw error;
            } else {
                // INSERT
                const { data: newOrder, error: insertError } = await supabase
                    .from('supplier_orders')
                    .insert({ ...payload, status: 'pending' })
                    .select()
                    .single();

                if (insertError) throw insertError;
                orderId = newOrder.id;
            }

            // Handle Linked Items (Delete all and re-insert for simplicity on edit)
            if (route.params?.orderToEdit) {
                await supabase.from('supplier_order_items').delete().eq('supplier_order_id', orderId);
            }

            if (selectedProducts.length > 0 && orderId) {
                const itemsPayload = [];
                const productUpdatePromises = [];

                for (const p of selectedProducts) {
                    if (!p.isNew && p.product.id) {
                        const uniqueColors = [...new Set(p.variants.map(v => v.color).filter(c => c))];
                        productUpdatePromises.push(
                            supabase.rpc('append_product_colors', {
                                p_id: p.product.id,
                                new_colors: uniqueColors
                            })
                        );
                        productUpdatePromises.push(
                            supabase.from('products').update({
                                name: p.product.name,
                                defect_notes: p.quality === 'flawed' ? 'Reportado en orden de compra' : null
                            }).eq('id', p.product.id)
                        );
                    }

                    p.variants.forEach(v => {
                        itemsPayload.push({
                            supplier_order_id: orderId,
                            product_id: p.isNew ? null : p.product.id,
                            temp_product_name: p.isNew ? p.tempName : null,
                            quantity: parseInt(v.quantity) || 1,
                            cost_per_unit: parseFloat(p.cost) || 0,
                            supplier: p.supplierName || payload.provider_name, // Use item supplier or fallback to order provider
                            color: v.color || null,
                            notes: p.quality === 'perfect' ? 'Sin fallas' : 'Con fallas'
                        });
                    });
                }

                await Promise.all(productUpdatePromises);

                const { error: itemsError } = await supabase
                    .from('supplier_order_items')
                    .insert(itemsPayload);

                if (itemsError) throw itemsError;
            }

            Alert.alert('✅ Éxito', `Orden ${route.params?.orderToEdit ? 'actualizada' : 'creada'} correctamente.`, [
                { text: 'OK', onPress: () => navigation.goBack() }
            ]);
        } catch (err) {
            Alert.alert('Error', 'No se pudo guardar: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color="#d4af37" />
                </TouchableOpacity>
                <Text style={styles.title}>{route.params?.orderToEdit ? 'EDITAR ORDEN' : 'REGISTRAR COMPRA (STOCK)'}</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView contentContainerStyle={styles.form}>
                <Text style={styles.label}>Fecha de Compra</Text>
                <TouchableOpacity onPress={() => setShowDatePicker(true)} style={[styles.input, { flexDirection: 'row', alignItems: 'center' }]}>
                    <MaterialCommunityIcons name="calendar" size={20} color="#666" style={{ marginRight: 10 }} />
                    <Text style={{ color: '#fff' }}>{purchaseDate.toLocaleDateString('es-AR')}</Text>
                </TouchableOpacity>
                {showDatePicker && (
                    <DateTimePicker
                        value={purchaseDate}
                        mode="date"
                        display="default"
                        onChange={(event, selectedDate) => {
                            setShowDatePicker(false);
                            if (selectedDate) setPurchaseDate(selectedDate);
                        }}
                    />
                )}

                <Text style={styles.label}>Proveedor / Tienda</Text>
                <TextInput
                    style={styles.input}
                    placeholder="Nombre de la empresa o negocio"
                    placeholderTextColor="#666"
                    value={provider}
                    onChangeText={setProvider}
                />

                <Text style={styles.label}>Empresa de Transporte</Text>
                <View style={styles.courierContainer}>
                    {['Andreani', 'OCA', 'Via Cargo'].map(c => (
                        <TouchableOpacity
                            key={c}
                            style={[styles.courierPill, courier === c && styles.courierPillActive]}
                            onPress={() => setCourier(courier === c ? '' : c)}
                        >
                            <Text style={[styles.courierText, courier === c && styles.courierTextActive]}>{c}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <Text style={styles.label}>Número de Seguimiento (Tracking)</Text>
                <View style={styles.trackingRow}>
                    <MaterialCommunityIcons name="barcode-scan" size={24} color="#666" style={{ marginRight: 10 }} />
                    <TextInput
                        style={[styles.input, { flex: 1, marginBottom: 0 }]}
                        placeholder="Pegar código de rastreo"
                        placeholderTextColor="#666"
                        value={tracking}
                        onChangeText={setTracking}
                    />
                </View>

                <Text style={styles.label}>Productos Vinculados (Opcional)</Text>
                <View style={[
                    styles.productsListContainer,
                    selectedProducts.length >= 3 && { height: 230 }
                ]}>
                    <ScrollView
                        nestedScrollEnabled
                        style={{ flexGrow: 0 }}
                        contentContainerStyle={{ flexGrow: 1 }}
                    >
                        {selectedProducts.map((item, pIdx) => (
                            <ProductItem
                                key={item.localId || `item-${pIdx}`}
                                item={item}
                                index={pIdx}
                                isExpanded={expandedIndex === pIdx}
                                onToggle={toggleExpand}
                                onRemove={removeProductItem}
                                onUpdate={updateProductItem}
                                onAddVariant={addVariantToProduct}
                                onUpdateVariant={updateVariant}
                                onRemoveVariant={removeVariant}
                                onOpenSupplier={() => openSupplierForProduct(pIdx)}
                                inputRef={el => inputRefs.current[pIdx] = el}
                            />
                        ))}
                    </ScrollView>
                </View>

                <TouchableOpacity style={styles.addProdBtn} onPress={() => setShowProductModal(true)}>
                    <MaterialCommunityIcons name="plus" size={20} color="#000" />
                    <Text style={styles.addProdText}>AGREGAR PRODUCTO / ITEM</Text>
                </TouchableOpacity>

                <Text style={styles.label}>Descripción Adicional / Notas</Text>
                <TextInput
                    style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                    placeholder="Detalle de productos o notas..."
                    placeholderTextColor="#666"
                    multiline
                    value={itemsDesc}
                    onChangeText={setItemsDesc}
                />

                <Text style={styles.label}>Costo Total (USD/ARS)</Text>
                <TextInput
                    style={styles.input}
                    placeholder="0.00"
                    placeholderTextColor="#666"
                    keyboardType="numeric"
                    value={cost}
                    onChangeText={setCost}
                />

                <Text style={styles.label}>Descuento (Monto Fijo $)</Text>
                <TextInput
                    style={[styles.input, { color: '#2ecc71', borderColor: discount > 0 ? '#2ecc71' : '#222' }]}
                    placeholder="0.00"
                    placeholderTextColor="#666"
                    keyboardType="numeric"
                    value={discount}
                    onChangeText={setDiscount}
                />

                {parseFloat(discount) > 0 && (
                    <View style={styles.summaryBox}>
                        <Text style={styles.summaryLabel}>Total a Pagar Final:</Text>
                        <Text style={styles.summaryValue}>
                            ${((parseFloat(cost) || 0) - (parseFloat(discount) || 0)).toFixed(2)}
                        </Text>
                    </View>
                )}

                <View style={styles.row}>
                    <View style={{ flex: 1, marginRight: 10 }}>
                        <Text style={styles.label}>Cuotas Totales</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="1"
                            placeholderTextColor="#666"
                            keyboardType="numeric"
                            value={installmentsTotal}
                            onChangeText={setInstallmentsTotal}
                        />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.label}>Cuotas Pagadas</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="0"
                            placeholderTextColor="#666"
                            keyboardType="numeric"
                            value={installmentsPaid}
                            onChangeText={setInstallmentsPaid}
                        />
                    </View>
                </View>

                <TouchableOpacity
                    style={styles.saveBtn}
                    onPress={handleSave}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color="#000" />
                    ) : (
                        <Text style={styles.saveText}>
                            {route.params?.orderToEdit ? 'ACTUALIZAR PEDIDO' : 'GUARDAR PEDIDO'}
                        </Text>
                    )}
                </TouchableOpacity>
            </ScrollView>

            {/* Product Selection Modal */}
            {
                showProductModal && (
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            <Text style={styles.modalTitle}>Seleccionar Producto</Text>
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Buscar..."
                                placeholderTextColor="#666"
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                            />
                            <ScrollView>
                                {products.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase())).map(p => (
                                    <TouchableOpacity key={p.id} style={styles.modalItem} onPress={() => addProductToOrder(p)}>
                                        <Text style={styles.modalItemText}>{p.name}</Text>
                                        <Text style={styles.modalItemSub}>Stock: {p.current_stock}</Text>
                                    </TouchableOpacity>
                                ))}
                                {searchQuery.length > 0 && (
                                    <TouchableOpacity
                                        style={[styles.modalItem, { borderTopWidth: 2, borderTopColor: '#d4af37' }]}
                                        onPress={() => addProductToOrder(null, true, searchQuery)}
                                    >
                                        <Text style={[styles.modalItemText, { color: '#d4af37' }]}>+ AGREGAR COMO NUEVO: "{searchQuery}"</Text>
                                        <Text style={styles.modalItemSub}>Producto no registrado en inventario</Text>
                                    </TouchableOpacity>
                                )}
                            </ScrollView>
                            <TouchableOpacity style={styles.closeModal} onPress={() => setShowProductModal(false)}>
                                <Text style={styles.closeText}>CERRAR</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )
            }

            {/* Supplier Selection Modal */}
            {
                showSupplierModal && (
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            <Text style={styles.modalTitle}>Mis Proveedores</Text>
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Buscar proveedor..."
                                placeholderTextColor="#666"
                                value={supplierSearch}
                                onChangeText={setSupplierSearch}
                            />
                            <ScrollView>
                                {suppliersList.filter(s => s.name.toLowerCase().includes(supplierSearch.toLowerCase())).map(s => (
                                    <TouchableOpacity key={s.id} style={styles.modalItem} onPress={() => selectSupplier(s)}>
                                        <Text style={styles.modalItemText}>{s.name}</Text>
                                        <Text style={styles.modalItemSub}>{s.category || 'Sin Categoría'}</Text>
                                    </TouchableOpacity>
                                ))}
                                {supplierSearch.length > 0 && !suppliersList.find(s => s.name.toLowerCase() === supplierSearch.toLowerCase()) && (
                                    <TouchableOpacity
                                        style={[styles.modalItem, { borderTopWidth: 2, borderTopColor: '#d4af37' }]}
                                        onPress={async () => {
                                            try {
                                                const { data, error } = await supabase.from('suppliers').insert({ name: supplierSearch }).select().single();
                                                if (error) throw error;
                                                if (data) {
                                                    selectSupplier(data);
                                                    fetchSuppliers();
                                                }
                                            } catch (err) {
                                                Alert.alert('Error', 'No se pudo crear el proveedor. Verificá si ya existe.');
                                            }
                                        }}
                                    >
                                        <Text style={[styles.modalItemText, { color: '#d4af37' }]}>+ AGREGAR COMO NUEVO: "{supplierSearch}"</Text>
                                        <Text style={styles.modalItemSub}>Crear proveedor al instante</Text>
                                    </TouchableOpacity>
                                )}
                                <TouchableOpacity
                                    style={[styles.modalItem, { borderTopWidth: 1, borderTopColor: '#333' }]}
                                    onPress={() => { setShowSupplierModal(false); setActiveSupplierItemIndex(null); navigation.navigate('Suppliers'); }}
                                >
                                    <Text style={[styles.modalItemText, { color: '#d4af37' }]}>+ GESTIONAR PROVEEDORES</Text>
                                </TouchableOpacity>
                            </ScrollView>
                            <TouchableOpacity style={styles.closeModal} onPress={() => { setShowSupplierModal(false); setActiveSupplierItemIndex(null); }}>
                                <Text style={styles.closeText}>CANCELAR</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )
            }
        </SafeAreaView >
    );
}

const ProductItem = memo(({
    item,
    index,
    isExpanded,
    onToggle,
    onRemove,
    onUpdate,
    onAddVariant,
    onUpdateVariant,
    onRemoveVariant,
    onOpenSupplier,
    inputRef
}) => {
    // Memoize total calculation to avoid unneeded math on every render
    const totalQty = useMemo(() => {
        return item.variants.reduce((sum, v) => sum + (parseInt(v.quantity) || 0), 0);
    }, [item.variants]);

    return (
        <View style={[styles.productCard, { borderLeftWidth: 4, borderLeftColor: isExpanded ? '#d4af37' : '#333' }]}>
            <TouchableOpacity
                style={styles.productCardHeader}
                onPress={() => onToggle(index)}
                activeOpacity={0.6} // More salient feedback
                delayPressIn={0}
                pressRetentionOffset={{ bottom: 10, left: 10, right: 10, top: 10 }}
            >
                <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={styles.productName} numberOfLines={1}>{item.product.name}</Text>
                        {!isExpanded && (
                            <View style={styles.qtyBadgeMini}>
                                <Text style={styles.qtyBadgeText}>x{totalQty}</Text>
                            </View>
                        )}
                    </View>
                    <Text style={{ color: '#666', fontSize: 10 }}>
                        {item.isNew ? 'NUEVO' : 'VINCULADO'} • {isExpanded ? 'Toca para contraer' : `Costo: $${item.cost} • ${item.variants.length} variantes`}
                    </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity
                        onPress={() => onRemove(index)}
                        style={{ marginRight: 15, padding: 5 }}
                        activeOpacity={0.4}
                        delayPressIn={0}
                    >
                        <MaterialCommunityIcons name="delete-outline" size={24} color="#e74c3c" />
                    </TouchableOpacity>
                    <MaterialCommunityIcons
                        name={isExpanded ? "chevron-up" : "chevron-down"}
                        size={24}
                        color={isExpanded ? "#d4af37" : "#666"}
                    />
                </View>
            </TouchableOpacity>

            {isExpanded && (
                <View style={{ marginTop: 10 }}>
                    <View style={{ marginBottom: 15 }}>
                        <Text style={styles.miniLabel}>Nombre del Producto</Text>
                        <TextInput
                            style={styles.miniInput}
                            placeholder="Nombre del producto"
                            placeholderTextColor="#666"
                            value={item.product.name}
                            onChangeText={v => onUpdate(index, 'name', v)}
                        />
                    </View>

                    <View style={{ marginBottom: 15 }}>
                        <Text style={styles.miniLabel}>Proveedor Específico</Text>
                        <TouchableOpacity
                            style={[styles.miniInput, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
                            onPress={onOpenSupplier}
                        >
                            <Text style={{ color: item.supplierName ? '#fff' : '#444', fontSize: 13 }}>
                                {item.supplierName || 'Seleccionar Proveedor Fabricante (Oficial)...'}
                            </Text>
                            <MaterialCommunityIcons name="factory" size={16} color="#d4af37" />
                        </TouchableOpacity>
                    </View>

                    <View style={{ marginBottom: 15 }}>
                        <Text style={styles.miniLabel}>Costo Unitario (USD/ARS)</Text>
                        <TextInput
                            ref={inputRef}
                            style={styles.miniInput}
                            placeholder="0.00"
                            placeholderTextColor="#666"
                            keyboardType="numeric"
                            value={item.cost}
                            onChangeText={v => onUpdate(index, 'cost', v)}
                        />
                    </View>

                    <Text style={[styles.miniLabel, { marginBottom: 10, color: '#999' }]}>COLORES Y CANTIDADES:</Text>
                    {item.variants.map((v, vIdx) => (
                        <View key={vIdx} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 10 }}>
                            <TextInput
                                style={[styles.miniInput, { flex: 2, marginBottom: 0 }]}
                                placeholder="Color / Modelo"
                                placeholderTextColor="#666"
                                value={v.color}
                                onChangeText={val => onUpdateVariant(index, vIdx, 'color', val)}
                            />
                            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#111', borderRadius: 8, padding: 2, borderWidth: 1, borderColor: '#333' }}>
                                <TouchableOpacity
                                    style={{ padding: 8 }}
                                    onPress={() => onUpdateVariant(index, vIdx, 'quantity', (parseInt(v.quantity) - 1).toString())}
                                    activeOpacity={0.2}
                                    delayPressIn={0}
                                >
                                    <MaterialCommunityIcons name="minus" size={16} color="#d4af37" />
                                </TouchableOpacity>
                                <TextInput
                                    style={{ color: '#fff', width: 35, textAlign: 'center', fontWeight: 'bold' }}
                                    keyboardType="numeric"
                                    value={v.quantity}
                                    onChangeText={val => onUpdateVariant(index, vIdx, 'quantity', val)}
                                />
                                <TouchableOpacity
                                    style={{ padding: 8 }}
                                    onPress={() => onUpdateVariant(index, vIdx, 'quantity', (parseInt(v.quantity) + 1).toString())}
                                    activeOpacity={0.2}
                                    delayPressIn={0}
                                >
                                    <MaterialCommunityIcons name="plus" size={16} color="#d4af37" />
                                </TouchableOpacity>
                            </View>
                            {item.variants.length > 1 && (
                                <TouchableOpacity
                                    onPress={() => onRemoveVariant(index, vIdx)}
                                    delayPressIn={0}
                                    style={{ padding: 5 }}
                                >
                                    <MaterialCommunityIcons name="close" size={20} color="#666" />
                                </TouchableOpacity>
                            )}
                        </View>
                    ))}

                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 15 }}>
                        <TouchableOpacity
                            style={[styles.qualityBtn, item.quality === 'perfect' && styles.qualityBtnActive]}
                            onPress={() => onUpdate(index, 'quality', 'perfect')}
                        >
                            <MaterialCommunityIcons name="check-circle" size={16} color={item.quality === 'perfect' ? '#000' : '#2ecc71'} />
                            <Text style={[styles.qualityText, item.quality === 'perfect' && styles.qualityTextActive]}>SIN FALLAS</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.qualityBtn, item.quality === 'flawed' && { backgroundColor: '#e74c3c' }]}
                            onPress={() => onUpdate(index, 'quality', 'flawed')}
                        >
                            <MaterialCommunityIcons name="alert-circle" size={16} color={item.quality === 'flawed' ? '#000' : '#e74c3c'} />
                            <Text style={[styles.qualityText, item.quality === 'flawed' && styles.qualityTextActive]}>CON DEFECTOS</Text>
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                        style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginTop: 15, padding: 8 }}
                        onPress={() => onAddVariant(index)}
                        delayPressIn={0}
                        activeOpacity={0.7}
                    >
                        <MaterialCommunityIcons name="plus-circle-outline" size={18} color="#3498db" />
                        <Text style={{ color: '#3498db', fontSize: 13, fontWeight: 'bold', marginLeft: 8 }}>Añadir otro color</Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
}, (prev, next) => {
    // Custom deep comparison to be 100% sure we only render when needed
    return (
        prev.isExpanded === next.isExpanded &&
        prev.item.cost === next.item.cost &&
        prev.item.product.name === next.item.product.name &&
        prev.item.variants === next.item.variants &&
        prev.item.quality === next.item.quality &&
        prev.item.supplierName === next.item.supplierName &&
        prev.index === next.index
    );
});

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    header: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#333' },
    title: { color: '#fff', fontSize: 18, fontWeight: 'bold', letterSpacing: 1 },
    form: { padding: 20 },

    label: { color: '#d4af37', marginBottom: 10, fontWeight: 'bold', marginTop: 10 },
    input: { backgroundColor: '#1e1e1e', color: '#fff', padding: 15, borderRadius: 10, marginBottom: 20, borderWidth: 1, borderColor: '#333' },
    row: { flexDirection: 'row', justifyContent: 'space-between' },

    trackingRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e1e1e', padding: 5, paddingLeft: 15, borderRadius: 10, borderWidth: 1, borderColor: '#333', marginBottom: 20 },

    saveBtn: { backgroundColor: '#d4af37', padding: 18, borderRadius: 10, alignItems: 'center', marginTop: 20 },
    saveText: { color: '#000', fontWeight: '900', fontSize: 16 },

    // Product Linking Styles
    productsListContainer: {
        backgroundColor: '#1a1a1a',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#333',
        overflow: 'hidden',
        marginBottom: 20
    },
    productCard: {
        backgroundColor: 'transparent',
        padding: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#333'
    },
    productCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    productCardRow: { flexDirection: 'row', marginBottom: 10 },
    productName: { color: '#fff', fontWeight: 'bold', fontSize: 16, flex: 1 },
    miniLabel: { color: '#d4af37', fontSize: 11, fontWeight: 'bold', marginBottom: 5 },
    miniInput: { backgroundColor: '#111', color: '#fff', padding: 10, borderRadius: 5, borderWidth: 1, borderColor: '#333' },
    addProdBtn: { flexDirection: 'row', backgroundColor: '#d4af37', padding: 10, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
    addProdText: { fontWeight: 'bold', marginLeft: 5, fontSize: 12 },

    qualityBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#333', gap: 8 },
    qualityBtnActive: { backgroundColor: '#2ecc71', borderColor: '#2ecc71' },
    qualityText: { color: '#666', fontSize: 10, fontWeight: '900' },
    qualityTextActive: { color: '#000' },

    modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 20 },
    modalContent: { backgroundColor: '#1e1e1e', borderRadius: 15, padding: 20, maxHeight: '80%' },
    modalTitle: { color: '#d4af37', fontSize: 20, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
    searchInput: { backgroundColor: '#111', color: '#fff', padding: 12, borderRadius: 8, marginBottom: 15, borderWidth: 1, borderColor: '#333' },
    modalItem: { padding: 15, borderBottomWidth: 1, borderBottomColor: '#333' },
    modalItemText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
    modalItemSub: { color: '#666', fontSize: 12 },
    closeModal: { marginTop: 15, alignItems: 'center', padding: 10 },
    closeText: { color: '#e74c3c', fontWeight: 'bold' },

    summaryBox: { backgroundColor: 'rgba(46, 204, 113, 0.1)', padding: 15, borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(46, 204, 113, 0.3)', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    summaryLabel: { color: '#888', fontSize: 12, fontWeight: 'bold' },
    summaryValue: { color: '#2ecc71', fontSize: 18, fontWeight: 'bold' },

    courierContainer: { flexDirection: 'row', gap: 10, marginBottom: 20 },
    courierPill: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#1e1e1e', borderWidth: 1, borderColor: '#333', alignItems: 'center' },
    courierPillActive: { backgroundColor: '#d4af37', borderColor: '#d4af37' },
    courierText: { color: '#666', fontWeight: 'bold', fontSize: 12 },
    courierTextActive: { color: '#000', fontWeight: '900' },
    qtyBadgeMini: { backgroundColor: '#d4af37', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, marginLeft: 8 },
    qtyBadgeText: { color: '#000', fontSize: 10, fontWeight: 'bold' },
});
