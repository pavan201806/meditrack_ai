import React, { useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { WebView } from 'react-native-webview';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';

const RagChatScreen = ({ navigation }) => {
    const { theme } = useTheme();
    const colors = theme.colors;
    const insets = useSafeAreaInsets();
    const webviewRef = useRef(null);

    // Injected JavaScript intercepts fetch and XHR calls made by the Vite app
    // to dynamically rewrite localhost:8000 to the correct local network IP 
    // so the mobile device can reach the backend server.
    const INJECTED_JAVASCRIPT = `
      window.isReactNative = true;
      
      const originalFetch = window.fetch;
      window.fetch = async function() {
        let args = Array.prototype.slice.call(arguments);
        if (typeof args[0] === 'string' && args[0].includes('localhost:8000')) {
          args[0] = args[0].replace('localhost:8000', '192.168.137.86:8000');
        } else if (args[0] && args[0].url && args[0].url.includes('localhost:8000')) {
          args[0] = new Request(args[0].url.replace('localhost:8000', '192.168.137.86:8000'), args[0]);
        }
        return originalFetch.apply(this, args);
      };

      const originalXhrOpen = XMLHttpRequest.prototype.open;
      XMLHttpRequest.prototype.open = function() {
        let args = Array.prototype.slice.call(arguments);
        if (typeof args[1] === 'string' && args[1].includes('localhost:8000')) {
          args[1] = args[1].replace('localhost:8000', '192.168.137.86:8000');
        }
        return originalXhrOpen.apply(this, args);
      };
      
      true;
    `;

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: colors.background }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <MaterialCommunityIcons name="arrow-down" size={28} color={colors.text} />
                </TouchableOpacity>
                <Text style={[theme.typography.h3, { color: colors.text, flex: 1, textAlign: 'center', marginRight: 40 }]}>
                    RAG Chat AI
                </Text>
            </View>

            <WebView
                ref={webviewRef}
                source={{ uri: 'http://192.168.137.86:5173' }}
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

export default RagChatScreen;
