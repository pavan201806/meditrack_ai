import React, { useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';

const VoiceAgentScreen = ({ navigation }) => {
    const { theme } = useTheme();
    const colors = theme.colors;
    const insets = useSafeAreaInsets();
    const webviewRef = useRef(null);

    const INJECTED_JAVASCRIPT = `
      // Auto-grant permissions or handle required browser API checks if needed
      window.isReactNative = true;
      true;
    `;

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: colors.background }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <MaterialCommunityIcons name="arrow-down" size={28} color={colors.text} />
                </TouchableOpacity>
                <Text style={[theme.typography.h3, { color: colors.text, flex: 1, textAlign: 'center', marginRight: 40 }]}>
                    Meal Mitra AI
                </Text>
            </View>

            <WebView
                ref={webviewRef}
                source={{ uri: 'http://192.168.137.86:3001' }}
                style={styles.webview}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                allowsInlineMediaPlayback={true}
                mediaPlaybackRequiresUserAction={false}
                userAgent="Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Mobile Safari/537.36"
                originWhitelist={['*']}
                injectedJavaScript={INJECTED_JAVASCRIPT}
                onPermissionRequest={(request) => {
                    request.grant();
                }}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingBottom: 10,
        zIndex: 10,
    },
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    webview: {
        flex: 1,
        backgroundColor: 'transparent',
    }
});

export default VoiceAgentScreen;
