import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
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

const Stack = createStackNavigator();

export default function AppNavigator() {
    return (
        <Stack.Navigator initialRouteName="Login">
            <Stack.Screen
                name="Login"
                component={LoginScreen}
                options={{ headerShown: false }}
            />
            <Stack.Screen
                name="Home"
                component={HomeScreen}
                options={{ headerShown: false }}
            />
            <Stack.Screen
                name="Stock"
                component={StockScreen}
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
                name="Admin"
                component={AdminScreen}
                options={{ headerShown: false }}
            />
            <Stack.Screen
                name="Expenses"
                component={ExpensesScreen}
                options={{ headerShown: false }}
            />
        </Stack.Navigator>
    );
}
