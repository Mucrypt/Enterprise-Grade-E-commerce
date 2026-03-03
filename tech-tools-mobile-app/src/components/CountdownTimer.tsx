// ============================================
// TechTools Mobile App - Countdown Timer Component
// ============================================

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AppColors, AppBorderRadius, AppSpacing, AppGradients } from '@/constants/appTheme';
import { formatCountdown } from '@/utils';

interface CountdownTimerProps {
  endTime: Date;
  title?: string;
}

export default function CountdownTimer({ endTime, title = 'Flash Sale Ends In' }: CountdownTimerProps) {
  const [countdown, setCountdown] = useState(formatCountdown(endTime));

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(formatCountdown(endTime));
    }, 1000);

    return () => clearInterval(timer);
  }, [endTime]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.timerContainer}>
        <TimeBox value={countdown.hours} label="HRS" />
        <Text style={styles.separator}>:</Text>
        <TimeBox value={countdown.minutes} label="MIN" />
        <Text style={styles.separator}>:</Text>
        <TimeBox value={countdown.seconds} label="SEC" />
      </View>
    </View>
  );
}

function TimeBox({ value, label }: { value: number; label: string }) {
  return (
    <LinearGradient
      colors={AppGradients.primary as [string, string]}
      style={styles.timeBox}
    >
      <Text style={styles.timeValue}>{String(value).padStart(2, '0')}</Text>
      <Text style={styles.timeLabel}>{label}</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  title: {
    fontSize: 12,
    color: AppColors.gray600,
    marginBottom: AppSpacing.sm,
    fontWeight: '600',
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: AppSpacing.xs,
  },
  timeBox: {
    width: 50,
    height: 50,
    borderRadius: AppBorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timeValue: {
    fontSize: 18,
    fontWeight: '700',
    color: AppColors.white,
  },
  timeLabel: {
    fontSize: 8,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
  },
  separator: {
    fontSize: 24,
    fontWeight: '700',
    color: AppColors.primary,
  },
});
