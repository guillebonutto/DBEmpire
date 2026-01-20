import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
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

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
    const insets = useSafeAreaInsets();
    const [userRole, setUserRole] = useState('seller');
    const bottomPadding = insets.bottom > 0 ? insets.bottom : 10;
    const tabBarHeight = Platform.OS === 'ios' ? 65 + insets.bottom : 65 + (insets.bottom > 0 ? insets.bottom / 2 : 5);

    useEffect(() => {
        const getRole = async () => {
            const role = await AsyncStorage.getItem('user_role');
            if (role) setUserRole(role);
        };
        getRole();
    }, []);

    return (
        <Tab.Navigator
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
            <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Home' }} />
            <Tab.Screen name="Inventario" component={StockScreen} options={{ title: 'Inventario' }} />

            {userRole === 'admin' && (
                <>
                    <Tab.Screen name="Balance" component={AdminScreen} options={{ title: 'Balance' }} />
                    <Tab.Screen name="Deudas" component={DebtsScreen} options={{ title: 'Deudas' }} />
                </>
            )}
        </Tab.Navigator>
    );
}

export default function AppNavigator() {
    return (
        <Stack.Navigator initialRouteName="Login">
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
        </Stack.Navigator>
    );
}
