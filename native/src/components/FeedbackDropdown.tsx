import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import {
  FeedbackPresetOption,
  getFeedbackOptionLabel,
  findFeedbackOptionByValue,
  OTHER_OPTION_ID,
  OTHER_PRESET_OPTION,
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
  allowOther?: boolean;
  otherPlaceholder?: string;
}

export function FeedbackDropdown({
  label,
  placeholder,
  options,
  selectedValue,
  onSelect,
  language = 'en',
  containerStyle,
  allowOther = true,
  otherPlaceholder,
}: FeedbackDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isOtherMode, setIsOtherMode] = useState(false);
  const [customText, setCustomText] = useState('');

  const matchedOption = findFeedbackOptionByValue(options, selectedValue);

  // Sync state if selectedValue is set externally
  useEffect(() => {
    if (!selectedValue) {
      if (!isOtherMode) {
        setCustomText('');
      }
    } else if (matchedOption) {
      setIsOtherMode(false);
    } else if (selectedValue === OTHER_PRESET_OPTION.en) {
      setIsOtherMode(true);
    } else {
      // It's a custom typed string
      setIsOtherMode(true);
      setCustomText(selectedValue);
    }
  }, [selectedValue, matchedOption]);

  const displayLabel = isOtherMode
    ? getFeedbackOptionLabel(OTHER_PRESET_OPTION, language)
    : matchedOption
    ? getFeedbackOptionLabel(matchedOption, language)
    : selectedValue || '';

  const handleSelectOption = (option: FeedbackPresetOption) => {
    if (option.id === OTHER_OPTION_ID) {
      setIsOtherMode(true);
      setIsOpen(false);
      onSelect(customText);
    } else {
      setIsOtherMode(false);
      onSelect(option.en);
      setIsOpen(false);
    }
  };

  const allOptions = allowOther ? [...options, OTHER_PRESET_OPTION] : options;

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
          {allOptions.map((option, index) => {
            const isSelected = isOtherMode
              ? option.id === OTHER_OPTION_ID
              : matchedOption?.id === option.id;
            const optionLabel = getFeedbackOptionLabel(option, language);
            const isLast = index === allOptions.length - 1;

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

      {isOtherMode && (
        <TextInput
          style={styles.otherInput}
          value={customText}
          onChangeText={(text) => {
            setCustomText(text);
            onSelect(text);
          }}
          placeholder={otherPlaceholder || 'Tell us in your words…'}
          placeholderTextColor="#64748b"
          maxLength={200}
          multiline={false}
          autoFocus={true}
        />
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
  otherInput: {
    backgroundColor: '#061325',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.45)',
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: theme.colors.text,
    fontSize: 13,
    marginTop: 8,
  },
});

