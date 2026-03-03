// ============================================
// TechTools Mobile App - Input Component
// ============================================

import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInputProps,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppColors, AppBorderRadius, AppSpacing } from '@/constants/appTheme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  leftIcon?: string;
  rightIcon?: string;
  onRightIconPress?: () => void;
}

export default function Input({
  label,
  error,
  leftIcon,
  rightIcon,
  onRightIconPress,
  secureTextEntry,
  ...props
}: InputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const showPasswordToggle = secureTextEntry !== undefined;

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      
      <View
        style={[
          styles.inputContainer,
          isFocused && styles.inputFocused,
          error && styles.inputError,
        ]}
      >
        {leftIcon && (
          <Ionicons
            name={leftIcon as any}
            size={20}
            color={isFocused ? AppColors.primary : AppColors.gray400}
            style={styles.leftIcon}
          />
        )}
        
        <TextInput
          style={[styles.input, leftIcon && styles.inputWithLeftIcon]}
          placeholderTextColor={AppColors.gray400}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          secureTextEntry={showPasswordToggle ? !isPasswordVisible : false}
          {...props}
        />
        
        {showPasswordToggle ? (
          <TouchableOpacity
            onPress={() => setIsPasswordVisible(!isPasswordVisible)}
            style={styles.rightIcon}
          >
            <Ionicons
              name={isPasswordVisible ? 'eye-outline' : 'eye-off-outline'}
              size={20}
              color={AppColors.gray400}
            />
          </TouchableOpacity>
        ) : rightIcon ? (
          <TouchableOpacity
            onPress={onRightIconPress}
            style={styles.rightIcon}
            disabled={!onRightIconPress}
          >
            <Ionicons name={rightIcon as any} size={20} color={AppColors.gray400} />
          </TouchableOpacity>
        ) : null}
      </View>
      
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: AppSpacing.base,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: AppColors.gray700,
    marginBottom: AppSpacing.sm,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.gray50,
    borderRadius: AppBorderRadius.lg,
    borderWidth: 1,
    borderColor: AppColors.gray200,
    paddingHorizontal: AppSpacing.base,
  },
  inputFocused: {
    borderColor: AppColors.primary,
    backgroundColor: AppColors.white,
  },
  inputError: {
    borderColor: AppColors.error,
  },
  input: {
    flex: 1,
    height: 48,
    fontSize: 15,
    color: AppColors.gray800,
  },
  inputWithLeftIcon: {
    marginLeft: AppSpacing.sm,
  },
  leftIcon: {
    marginRight: AppSpacing.xs,
  },
  rightIcon: {
    padding: AppSpacing.xs,
  },
  errorText: {
    fontSize: 12,
    color: AppColors.error,
    marginTop: AppSpacing.xs,
  },
});
