import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import {
  FeedbackPresetOption,
  getFeedbackOptionLabel,
  findFeedbackOptionByValue,
} from '../lib/feedbackPresets';
import { theme } from '../theme';

interface FeedbackDropdownProps {
  label: string;
  placeholder: string;
  options: FeedbackPresetOption[];
  selectedValue: string;
  onSelect: (value: string) => void;
  language?: string;
  containerStyle?: ViewStyle;
}

export function FeedbackDropdown({
  label,
  placeholder,
  options,
  selectedValue,
  onSelect,
  language = 'en',
  containerStyle,
}: FeedbackDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);

  const matchedOption = findFeedbackOptionByValue(options, selectedValue);
  const displayLabel = matchedOption
    ? getFeedbackOptionLabel(matchedOption, language)
    : selectedValue
    ? selectedValue
    : '';

  const handleSelectOption = (option: FeedbackPresetOption) => {
    // Send the canonical English option text for backend & Google Sheets parity
    onSelect(option.en);
    setIsOpen(false);
  };

  return (
    <View style={[styles.container, containerStyle]}>
      <Text style={styles.fieldLabel}>{label} *</Text>

      <TouchableOpacity
        style={[styles.selectorButton, isOpen && styles.selectorButtonOpen]}
        onPress={() => setIsOpen((prev) => !prev)}
        activeOpacity={0.8}
        accessibilityRole="combobox"
        accessibilityState={{ expanded: isOpen }}
      >
        <Text
          style={[
            styles.selectorText,
            !displayLabel && styles.placeholderText,
          ]}
          numberOfLines={2}
        >
          {displayLabel || placeholder}
        </Text>
        <Text style={styles.chevronIcon}>{isOpen ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {isOpen && (
        <View style={styles.dropdownContainer}>
          {options.map((option, index) => {
            const isSelected =
              matchedOption?.id === option.id ||
              selectedValue.toLowerCase() === option.en.toLowerCase() ||
              selectedValue.toLowerCase() === option.hi.toLowerCase() ||
              selectedValue.toLowerCase() === option.kn.toLowerCase();
            const optionLabel = getFeedbackOptionLabel(option, language);
            const isLast = index === options.length - 1;

            return (
              <TouchableOpacity
                key={option.id}
                style={[
                  styles.optionItem,
                  isSelected && styles.optionItemSelected,
                  !isLast && styles.optionItemBorder,
                ]}
                onPress={() => handleSelectOption(option)}
                activeOpacity={0.7}
                accessibilityRole="radio"
                accessibilityState={{ checked: isSelected }}
              >
                <Text
                  style={[
                    styles.optionText,
                    isSelected && styles.optionTextSelected,
                  ]}
                >
                  {optionLabel}
                </Text>
                {isSelected && <Text style={styles.checkIcon}>✓</Text>}
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  fieldLabel: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  selectorButton: {
    backgroundColor: '#061325',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.28)',
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
  },
  selectorButtonOpen: {
    borderColor: theme.colors.cyan,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  selectorText: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
    lineHeight: 18,
  },
  placeholderText: {
    color: '#64748b',
    fontWeight: '500',
  },
  chevronIcon: {
    color: theme.colors.cyan,
    fontSize: 11,
    marginLeft: 4,
  },
  dropdownContainer: {
    backgroundColor: '#07172c',
    borderWidth: 1,
    borderColor: theme.colors.cyan,
    borderTopWidth: 0,
    borderBottomLeftRadius: theme.radius.md,
    borderBottomRightRadius: theme.radius.md,
    overflow: 'hidden',
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  optionItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  optionItemSelected: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
  },
  optionText: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
    lineHeight: 18,
    marginRight: 8,
  },
  optionTextSelected: {
    color: theme.colors.cyan,
    fontWeight: '700',
  },
  checkIcon: {
    color: theme.colors.cyan,
    fontSize: 14,
    fontWeight: '800',
  },
});
