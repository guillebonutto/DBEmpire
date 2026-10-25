import React from 'react';
import { View, StyleSheet } from 'react-native';
import ImperialAgendaView from '../components/ImperialAgendaView';

export default function AgendaScreen({ navigation }) {
    return (
        <View style={styles.container}>
            <ImperialAgendaView
                isScreen={true}
                onClose={() => navigation.goBack()}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#121316',
    },
});
