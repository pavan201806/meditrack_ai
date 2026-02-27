import React, { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    KeyboardAvoidingView, Platform, ScrollView, Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import ActionButton from '../../components/ActionButton';
import { authAPI } from '../../services/api';

const LoginScreen = ({ navigation }) => {
    const { theme } = useTheme();
    const colors = theme.colors;
    const insets = useSafeAreaInsets();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);

    const validate = () => {
        const newErrors = {};
        if (!email) newErrors.email = 'Email is required';
        else if (!/\S+@\S+\.\S+/.test(email)) newErrors.email = 'Invalid email format';
        if (!password) newErrors.password = 'Password is required';
        else if (password.length < 6) newErrors.password = 'Password must be at least 6 characters';
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleLogin = async () => {
        if (!validate()) return;
        setLoading(true);
        try {
            await authAPI.login(email, password);
            navigation.replace('Main');
        } catch (err) {
            Alert.alert('Login Failed', err.message || 'Invalid email or password');
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={{ flex: 1, backgroundColor: colors.background }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <ScrollView
                contentContainerStyle={[styles.container, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 20 }]}
                keyboardShouldPersistTaps="handled"
            >
                {/* Logo */}
                <View style={styles.logoContainer}>
                    <View style={[styles.logoCircle, { backgroundColor: colors.accent }]}>
                        <MaterialCommunityIcons name="medical-bag" size={40} color={colors.primary} />
                    </View>
                    <Text style={[theme.typography.h1, { color: colors.text, marginTop: 16 }]}>
                        MediTrack AI
                    </Text>
                    <Text style={[theme.typography.body, { color: colors.textSecondary, marginTop: 4 }]}>
                        Sign in to your account
                    </Text>
                </View>

                {/* Form */}
                <View style={styles.form}>
                    <View style={styles.inputGroup}>
                        <Text style={[theme.typography.label, { color: colors.textSecondary, marginBottom: 6 }]}>
                            EMAIL
                        </Text>
                        <View
                            style={[
                                styles.inputContainer,
                                { backgroundColor: colors.surface, borderColor: errors.email ? colors.error : colors.border },
                            ]}
                        >
                            <MaterialCommunityIcons name="email-outline" size={20} color={colors.textTertiary} />
                            <TextInput
                                style={[styles.input, theme.typography.body, { color: colors.text }]}
                                placeholder="your@email.com"
                                placeholderTextColor={colors.textTertiary}
                                value={email}
                                onChangeText={setEmail}
                                keyboardType="email-address"
                                autoCapitalize="none"
                            />
                            {email && !errors.email && (
                                <MaterialCommunityIcons name="check-circle" size={20} color={colors.primary} />
                            )}
                        </View>
                        {errors.email && (
                            <Text style={[theme.typography.bodySmall, { color: colors.error, marginTop: 4 }]}>
                                {errors.email}
                            </Text>
                        )}
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={[theme.typography.label, { color: colors.textSecondary, marginBottom: 6 }]}>
                            PASSWORD
                        </Text>
                        <View
                            style={[
                                styles.inputContainer,
                                { backgroundColor: colors.surface, borderColor: errors.password ? colors.error : colors.border },
                            ]}
                        >
                            <MaterialCommunityIcons name="lock-outline" size={20} color={colors.textTertiary} />
                            <TextInput
                                style={[styles.input, theme.typography.body, { color: colors.text }]}
                                placeholder="••••••••"
                                placeholderTextColor={colors.textTertiary}
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry={!showPassword}
                            />
                            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                                <MaterialCommunityIcons
                                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                                    size={20}
                                    color={colors.textTertiary}
                                />
                            </TouchableOpacity>
                        </View>
                        {errors.password && (
                            <Text style={[theme.typography.bodySmall, { color: colors.error, marginTop: 4 }]}>
                                {errors.password}
                            </Text>
                        )}
                    </View>

                    <TouchableOpacity style={styles.forgotPassword}>
                        <Text style={[theme.typography.bodySmall, { color: colors.primary, fontWeight: '600' }]}>
                            Forgot Password?
                        </Text>
                    </TouchableOpacity>

                    <ActionButton
                        title="Sign In"
                        onPress={handleLogin}
                        variant="dark"
                        fullWidth
                        style={{ marginTop: 8 }}
                    />
                </View>

                {/* Divider */}
                <View style={styles.dividerRow}>
                    <View style={[styles.divider, { backgroundColor: colors.border }]} />
                    <Text style={[theme.typography.bodySmall, { color: colors.textTertiary, marginHorizontal: 12 }]}>
                        OR
                    </Text>
                    <View style={[styles.divider, { backgroundColor: colors.border }]} />
                </View>

                {/* Social */}
                <View style={styles.socialRow}>
                    <TouchableOpacity style={[styles.socialButton, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <MaterialCommunityIcons name="google" size={22} color="#DB4437" />
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.socialButton, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <MaterialCommunityIcons name="apple" size={22} color={colors.text} />
                    </TouchableOpacity>
                </View>

                {/* Sign Up */}
                <View style={styles.signupRow}>
                    <Text style={[theme.typography.body, { color: colors.textSecondary }]}>
                        Don't have an account?{' '}
                    </Text>
                    <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
                        <Text style={[theme.typography.body, { color: colors.primary, fontWeight: '600' }]}>
                            Sign Up
                        </Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        flexGrow: 1,
        paddingHorizontal: 24,
    },
    logoContainer: {
        alignItems: 'center',
        marginBottom: 36,
    },
    logoCircle: {
        width: 80,
        height: 80,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    form: {
        gap: 16,
    },
    inputGroup: {},
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 14,
        borderWidth: 1.5,
        paddingHorizontal: 14,
        height: 52,
        gap: 10,
    },
    input: {
        flex: 1,
        height: '100%',
    },
    forgotPassword: {
        alignSelf: 'flex-end',
    },
    dividerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 24,
    },
    divider: {
        flex: 1,
        height: 1,
    },
    socialRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 16,
    },
    socialButton: {
        width: 56,
        height: 56,
        borderRadius: 16,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    signupRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 24,
    },
});

export default LoginScreen;
