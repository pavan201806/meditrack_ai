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

const SignupScreen = ({ navigation }) => {
    const { theme } = useTheme();
    const colors = theme.colors;
    const insets = useSafeAreaInsets();

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [role, setRole] = useState('patient');
    const [showPassword, setShowPassword] = useState(false);
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);

    const validate = () => {
        const newErrors = {};
        if (!name) newErrors.name = 'Name is required';
        if (!email) newErrors.email = 'Email is required';
        else if (!/\S+@\S+\.\S+/.test(email)) newErrors.email = 'Invalid email format';
        if (!phone) newErrors.phone = 'Phone number is required';
        if (!password) newErrors.password = 'Password is required';
        else if (password.length < 6) newErrors.password = 'Minimum 6 characters';
        if (password !== confirmPassword) newErrors.confirmPassword = 'Passwords do not match';
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSignup = async () => {
        if (!validate()) return;
        setLoading(true);
        try {
            await authAPI.signup(name, email, phone, password, role);
            navigation.replace('Main');
        } catch (err) {
            Alert.alert('Signup Failed', err.message || 'Could not create account');
        } finally {
            setLoading(false);
        }
    };

    const InputField = ({ label, icon, value, onChangeText, error, placeholder, secure, keyboardType }) => (
        <View style={styles.inputGroup}>
            <Text style={[theme.typography.label, { color: colors.textSecondary, marginBottom: 6 }]}>
                {label}
            </Text>
            <View
                style={[
                    styles.inputContainer,
                    { backgroundColor: colors.surface, borderColor: error ? colors.error : colors.border },
                ]}
            >
                <MaterialCommunityIcons name={icon} size={20} color={colors.textTertiary} />
                <TextInput
                    style={[styles.input, theme.typography.body, { color: colors.text }]}
                    placeholder={placeholder}
                    placeholderTextColor={colors.textTertiary}
                    value={value}
                    onChangeText={onChangeText}
                    secureTextEntry={secure && !showPassword}
                    keyboardType={keyboardType}
                    autoCapitalize={keyboardType === 'email-address' ? 'none' : 'words'}
                />
                {value && !error && (
                    <MaterialCommunityIcons name="check-circle" size={20} color={colors.primary} />
                )}
            </View>
            {error && (
                <Text style={[theme.typography.bodySmall, { color: colors.error, marginTop: 4 }]}>
                    {error}
                </Text>
            )}
        </View>
    );

    return (
        <KeyboardAvoidingView
            style={{ flex: 1, backgroundColor: colors.background }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <ScrollView
                contentContainerStyle={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}
                keyboardShouldPersistTaps="handled"
            >
                {/* Header */}
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
                </TouchableOpacity>

                <View style={styles.headerText}>
                    <Text style={[theme.typography.h1, { color: colors.text }]}>Create Account</Text>
                    <Text style={[theme.typography.body, { color: colors.textSecondary, marginTop: 4 }]}>
                        Start your health journey today
                    </Text>
                </View>

                {/* Form */}
                <View style={styles.form}>
                    <InputField
                        label="FULL NAME"
                        icon="account-outline"
                        value={name}
                        onChangeText={setName}
                        error={errors.name}
                        placeholder="John Doe"
                    />
                    <InputField
                        label="EMAIL"
                        icon="email-outline"
                        value={email}
                        onChangeText={setEmail}
                        error={errors.email}
                        placeholder="your@email.com"
                        keyboardType="email-address"
                    />
                    <InputField
                        label="PHONE NUMBER"
                        icon="phone-outline"
                        value={phone}
                        onChangeText={setPhone}
                        error={errors.phone}
                        placeholder="+919876543210"
                        keyboardType="phone-pad"
                    />
                    <InputField
                        label="PASSWORD"
                        icon="lock-outline"
                        value={password}
                        onChangeText={setPassword}
                        error={errors.password}
                        placeholder="••••••••"
                        secure
                    />
                    <InputField
                        label="CONFIRM PASSWORD"
                        icon="lock-check-outline"
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        error={errors.confirmPassword}
                        placeholder="••••••••"
                        secure
                    />

                    {/* Role Selection */}
                    <View style={styles.inputGroup}>
                        <Text style={[theme.typography.label, { color: colors.textSecondary, marginBottom: 6 }]}>
                            I AM A
                        </Text>
                        <View style={styles.roleContainer}>
                            <TouchableOpacity
                                style={[
                                    styles.roleButton,
                                    role === 'patient' && { backgroundColor: colors.primary, borderColor: colors.primary }
                                ]}
                                onPress={() => setRole('patient')}
                            >
                                <MaterialCommunityIcons
                                    name="pill"
                                    size={20}
                                    color={role === 'patient' ? '#fff' : colors.textTertiary}
                                />
                                <Text style={[
                                    theme.typography.body,
                                    { color: role === 'patient' ? '#fff' : colors.textSecondary, marginLeft: 8, fontWeight: role === 'patient' ? '600' : '400' }
                                ]}>
                                    Patient
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.roleButton,
                                    role === 'caretaker' && { backgroundColor: colors.primary, borderColor: colors.primary }
                                ]}
                                onPress={() => setRole('caretaker')}
                            >
                                <MaterialCommunityIcons
                                    name="heart-pulse"
                                    size={20}
                                    color={role === 'caretaker' ? '#fff' : colors.textTertiary}
                                />
                                <Text style={[
                                    theme.typography.body,
                                    { color: role === 'caretaker' ? '#fff' : colors.textSecondary, marginLeft: 8, fontWeight: role === 'caretaker' ? '600' : '400' }
                                ]}>
                                    Caretaker
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <ActionButton
                        title="Create Account"
                        onPress={handleSignup}
                        variant="dark"
                        fullWidth
                        style={{ marginTop: 8 }}
                    />
                </View>

                {/* Sign In */}
                <View style={styles.signinRow}>
                    <Text style={[theme.typography.body, { color: colors.textSecondary }]}>
                        Already have an account?{' '}
                    </Text>
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <Text style={[theme.typography.body, { color: colors.primary, fontWeight: '600' }]}>
                            Sign In
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
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    headerText: {
        marginBottom: 28,
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
    signinRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 24,
    },
    roleContainer: {
        flexDirection: 'row',
        gap: 12,
    },
    roleButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 52,
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
    },
});

export default SignupScreen;
