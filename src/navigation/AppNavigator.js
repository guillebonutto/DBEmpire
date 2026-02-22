import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { View, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect } from 'react';

import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import StockScreen from '../screens/StockScreen';
import AddProductScreen from '../screens/AddProductScreen';
import ClientsScreen from '../screens/ClientsScreen';
import SalesScreen from '../screens/SalesScreen';
import NewSaleScreen from '../screens/NewSaleScreen';
import PromotionsScreen from '../screens/PromotionsScreen';
import ReportsScreen from '../screens/ReportsScreen';
import AdminScreen from '../screens/AdminScreen';
import ExpensesScreen from '../screens/ExpensesScreen';
import OrdersScreen from '../screens/OrdersScreen';
import NewOrderScreen from '../screens/NewOrderScreen';
import SupplierOrdersScreen from '../screens/SupplierOrdersScreen';
import NewSupplierOrderScreen from '../screens/NewSupplierOrderScreen';
import DebtsScreen from '../screens/DebtsScreen';
import CatalogScreen from '../screens/CatalogScreen';
import ClientDetailScreen from '../screens/ClientDetailScreen';
import BulkAdjustmentScreen from '../screens/BulkAdjustmentScreen';
import AnalyticsScreen from '../screens/AnalyticsScreen';
import IncidentsScreen from '../screens/IncidentsScreen';
import AssetsScreen from '../screens/AssetsScreen';
import RestockAdvisorScreen from '../screens/RestockAdvisorScreen';
import ActivityLogScreen from '../screens/ActivityLogScreen';
import ShippingPackagesScreen from '../screens/ShippingPackagesScreen';
import ShippingRatesScreen from '../screens/ShippingRatesScreen';
import ManualStockAdjustmentScreen from '../screens/ManualStockAdjustmentScreen';
import SuppliersScreen from '../screens/SuppliersScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
    const insets = useSafeAreaInsets();
    const [userRole, setUserRole] = useState('seller');
    const isAndroid = Platform.OS === 'android';
    const bottomPadding = insets.bottom > 0 ? insets.bottom : (isAndroid ? 15 : 10);
    const tabBarHeight = 65 + (insets.bottom > 0 ? insets.bottom : (isAndroid ? 10 : 0));

    useEffect(() => {
        const getRole = async () => {
            const role = await AsyncStorage.getItem('user_role');
            if (role) setUserRole(role);
        };
        getRole();
    }, []);

    return (
        <Tab.Navigator
            initialRouteName="Home"
            screenOptions={({ route }) => ({
                headerShown: false,
                tabBarStyle: {
                    backgroundColor: '#000',
                    borderTopColor: '#333',
                    height: tabBarHeight,
                    paddingBottom: bottomPadding,
                    paddingTop: 10,
                    elevation: 0,
                    borderTopWidth: 1
                },
                tabBarActiveTintColor: '#d4af37',
                tabBarInactiveTintColor: '#666',
                tabBarLabelStyle: {
                    fontSize: 10,
                    fontWeight: '700'
                },
                tabBarIcon: ({ focused, color, size }) => {
                    let iconName;
                    if (route.name === 'Home') iconName = 'home-variant';
                    else if (route.name === 'Balance') iconName = 'scale-balance';
                    else if (route.name === 'Deudas') iconName = 'cash-check';
                    else if (route.name === 'Presupuestos') iconName = 'file-document-edit';
                    else if (route.name === 'Inventario') iconName = 'package-variant-closed';

                    return (
                        <View style={focused ? {
                            backgroundColor: 'rgba(212, 175, 55, 0.1)',
                            padding: 8,
                            borderRadius: 12
                        } : null}>
                            <MaterialCommunityIcons name={iconName} size={24} color={color} />
                        </View>
                    );
                },
            })}
        >
            <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Dashboard' }} />
            <Tab.Screen name="Inventario" component={StockScreen} options={{ title: 'Inventario' }} />
            <Tab.Screen name="Presupuestos" component={OrdersScreen} options={{ title: 'Presupuestos' }} />
            {userRole === 'admin' ? (
                <Tab.Screen name="Balance" component={AdminScreen} options={{ title: 'Balance' }} />
            ) : null}
            {userRole === 'admin' ? (
                <Tab.Screen name="Deudas" component={DebtsScreen} options={{ title: 'Deudas' }} />
            ) : null}
        </Tab.Navigator>
    );
}

export default function AppNavigator() {
    const [initialRoute, setInitialRoute] = useState(null);

    useEffect(() => {
        const checkSession = async () => {
            const role = await AsyncStorage.getItem('user_role');
            // If we have a role, go straight to Main (Inventory). 
            // The hardware check will still happen in the background or during sensitive ops.
            setInitialRoute(role ? 'Main' : 'Login');
        };
        checkSession();
    }, []);

    if (initialRoute === null) return <View style={{ flex: 1, backgroundColor: '#000' }} />;

    return (
        <Stack.Navigator
            initialRouteName={initialRoute}
            screenOptions={{
                headerShown: false
            }}
        >
            <Stack.Screen
                name="Login"
                component={LoginScreen}
                options={{ headerShown: false }}
            />
            <Stack.Screen
                name="Main"
                component={MainTabs}
                options={{ headerShown: false }}
            />
            <Stack.Screen
                name="AddProduct"
                component={AddProductScreen}
                options={{ headerShown: false }}
            />
            <Stack.Screen
                name="Clients"
                component={ClientsScreen}
                options={{ headerShown: false }}
            />
            <Stack.Screen
                name="Sales"
                component={SalesScreen}
                options={{ headerShown: false }}
            />
            <Stack.Screen
                name="NewSale"
                component={NewSaleScreen}
                options={{ headerShown: false }}
            />
            <Stack.Screen
                name="Promotions"
                component={PromotionsScreen}
                options={{ headerShown: false }}
            />
            <Stack.Screen
                name="Reports"
                component={ReportsScreen}
                options={{ headerShown: false }}
            />
            <Stack.Screen
                name="Expenses"
                component={ExpensesScreen}
                options={{ headerShown: false }}
            />
            <Stack.Screen
                name="Orders"
                component={OrdersScreen}
                options={{ headerShown: false }}
            />
            <Stack.Screen
                name="NewOrder"
                component={NewOrderScreen}
                options={{ headerShown: false }}
            />
            <Stack.Screen
                name="SupplierOrders"
                component={SupplierOrdersScreen}
                options={{ headerShown: false }}
            />
            <Stack.Screen
                name="NewSupplierOrder"
                component={NewSupplierOrderScreen}
                options={{ headerShown: false }}
            />
            <Stack.Screen
                name="Catalog"
                component={CatalogScreen}
                options={{ headerShown: false }}
            />
            <Stack.Screen
                name="ClientDetail"
                component={ClientDetailScreen}
                options={{ headerShown: false }}
            />
            <Stack.Screen
                name="BulkAdjustment"
                component={BulkAdjustmentScreen}
                options={{ headerShown: false }}
            />
            <Stack.Screen
                name="Analytics"
                component={AnalyticsScreen}
                options={{ headerShown: false }}
            />
            <Stack.Screen
                name="Incidents"
                component={IncidentsScreen}
                options={{ headerShown: false }}
            />
            <Stack.Screen
                name="Assets"
                component={AssetsScreen}
                options={{ headerShown: false }}
            />
            <Stack.Screen
                name="RestockAdvisor"
                component={RestockAdvisorScreen}
                options={{ headerShown: false }}
            />
            <Stack.Screen
                name="ActivityLog"
                component={ActivityLogScreen}
                options={{ headerShown: false }}
            />
            <Stack.Screen
                name="ShippingPackages"
                component={ShippingPackagesScreen}
                options={{ headerShown: false }}
            />
            <Stack.Screen
                name="ShippingRates"
                component={ShippingRatesScreen}
                options={{ headerShown: false }}
            />
            <Stack.Screen
                name="ManualStockAdjustment"
                component={ManualStockAdjustmentScreen}
                options={{ headerShown: false }}
            />
            <Stack.Screen
                name="Suppliers"
                component={SuppliersScreen}
                options={{ headerShown: false }}
            />
        </Stack.Navigator>
    );
}
