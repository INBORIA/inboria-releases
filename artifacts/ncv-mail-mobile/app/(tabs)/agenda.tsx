import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  useListAppointments,
  useCreateAppointment,
  useDeleteAppointment,
  getListAppointmentsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import { useTranslation } from "react-i18next";
import { format, parseISO, startOfMonth, endOfMonth, addMonths, subMonths, isToday, isSameDay } from "date-fns";

export default function AgendaScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formLocation, setFormLocation] = useState("");
  const [formParticipants, setFormParticipants] = useState("");

  const rangeStart = startOfMonth(currentDate);
  const rangeEnd = endOfMonth(currentDate);

  const { data: appointments = [], isLoading } = useListAppointments({
    from: rangeStart.toISOString(),
    to: rangeEnd.toISOString(),
  });

  const createAppointment = useCreateAppointment();
  const deleteAppointment = useDeleteAppointment();

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: getListAppointmentsQueryKey() });
    setRefreshing(false);
  }, [queryClient]);

  const dayAppointments = useMemo(() => {
    return (appointments as any[]).filter((apt: any) => {
      return isSameDay(parseISO(apt.startAt), selectedDay);
    });
  }, [appointments, selectedDay]);

  const handleDelete = (id: string, title: string) => {
    Alert.alert(
      t("agenda.deleteAppointment"),
      t("agenda.deleteConfirm"),
      [
        { text: t("agenda.cancel"), style: "cancel" },
        {
          text: t("agenda.deleteAppointment"),
          style: "destructive",
          onPress: () => {
            deleteAppointment.mutate(
              { id },
              {
                onSuccess: () => {
                  queryClient.invalidateQueries({ queryKey: getListAppointmentsQueryKey() });
                },
              }
            );
          },
        },
      ]
    );
  };

  const handleCreate = () => {
    if (!formTitle.trim()) return;
    const startAt = new Date(selectedDay);
    startAt.setHours(9, 0, 0, 0);
    const endAt = new Date(selectedDay);
    endAt.setHours(10, 0, 0, 0);
    createAppointment.mutate(
      {
        data: {
          title: formTitle,
          description: formDescription || undefined,
          location: formLocation || undefined,
          startAt: startAt.toISOString(),
          endAt: endAt.toISOString(),
          allDay: false,
          participants: formParticipants || undefined,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListAppointmentsQueryKey() });
          setShowCreate(false);
          setFormTitle("");
          setFormDescription("");
          setFormLocation("");
          setFormParticipants("");
        },
      }
    );
  };

  const monthLabel = format(currentDate, "MMMM yyyy");

  const daysInMonth = useMemo(() => {
    const days: Date[] = [];
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    let d = start;
    while (d <= end) {
      days.push(new Date(d));
      d = new Date(d.getTime() + 86400000);
    }
    return days;
  }, [currentDate]);

  const getApptCountForDay = (day: Date) => {
    return (appointments as any[]).filter((apt: any) => isSameDay(parseISO(apt.startAt), day)).length;
  };

  const renderAppointment = ({ item }: { item: any }) => (
    <View style={[s.card, { backgroundColor: colors.card, borderColor: item.confirmed === false ? "#f59e0b30" : colors.border }]}>
      <View style={s.cardHeader}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <Text style={[s.cardTitle, { color: colors.foreground }]}>{item.title}</Text>
            {item.confirmed === false && (
              <View style={{ backgroundColor: "#f59e0b20", paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 }}>
                <Text style={{ color: "#f59e0b", fontSize: 9, fontFamily: "Inter_500Medium" }}>{t("agenda.suggestion")}</Text>
              </View>
            )}
          </View>
          <View style={s.timeRow}>
            <MaterialCommunityIcons name="clock-outline" size={12} color={colors.mutedForeground} />
            <Text style={[s.timeText, { color: colors.mutedForeground }]}>
              {item.allDay ? t("agenda.allDay") : `${format(parseISO(item.startAt), "HH:mm")} - ${format(parseISO(item.endAt), "HH:mm")}`}
            </Text>
          </View>
          {item.location ? (
            <View style={s.timeRow}>
              <MaterialCommunityIcons name="map-marker-outline" size={12} color={colors.mutedForeground} />
              <Text style={[s.timeText, { color: colors.mutedForeground }]}>{item.location}</Text>
            </View>
          ) : null}
          {item.participants ? (
            <View style={s.timeRow}>
              <MaterialCommunityIcons name="account-group-outline" size={12} color={colors.mutedForeground} />
              <Text style={[s.timeText, { color: colors.mutedForeground }]}>{item.participants}</Text>
            </View>
          ) : null}
          {item.description ? (
            <Text style={[s.descText, { color: colors.mutedForeground }]} numberOfLines={2}>
              {item.description}
            </Text>
          ) : null}
        </View>
        <TouchableOpacity onPress={() => handleDelete(item.id, item.title)} style={s.deleteBtn}>
          <MaterialCommunityIcons name="delete-outline" size={18} color="#ef4444" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <View style={[s.monthHeader, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => setCurrentDate(subMonths(currentDate, 1))}>
          <MaterialCommunityIcons name="chevron-left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setCurrentDate(new Date())}>
          <Text style={[s.monthTitle, { color: colors.foreground }]}>{monthLabel}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setCurrentDate(addMonths(currentDate, 1))}>
          <MaterialCommunityIcons name="chevron-right" size={24} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      <View style={[s.daysRow, { borderBottomColor: colors.border }]}>
        {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
          <View key={i} style={s.dayHeader}>
            <Text style={[s.dayHeaderText, { color: colors.mutedForeground }]}>{d}</Text>
          </View>
        ))}
      </View>

      <View style={s.calendarGrid}>
        {Array.from({ length: (daysInMonth[0]?.getDay() || 7) - 1 }).map((_, i) => (
          <View key={`empty-${i}`} style={s.dayCell} />
        ))}
        {daysInMonth.map((day) => {
          const count = getApptCountForDay(day);
          const selected = isSameDay(day, selectedDay);
          const today = isToday(day);
          return (
            <TouchableOpacity
              key={day.getTime()}
              style={[
                s.dayCell,
                selected && { backgroundColor: colors.primary + "30", borderRadius: 8 },
              ]}
              onPress={() => setSelectedDay(day)}
            >
              <Text
                style={[
                  s.dayCellText,
                  { color: today ? colors.primary : colors.foreground },
                  today && s.todayText,
                ]}
              >
                {format(day, "d")}
              </Text>
              {count > 0 && (
                <View style={[s.dot, { backgroundColor: colors.primary }]} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={[s.listHeader, { borderTopColor: colors.border }]}>
        <Text style={[s.listTitle, { color: colors.foreground }]}>
          {format(selectedDay, "d MMMM")} ({dayAppointments.length})
        </Text>
        <TouchableOpacity onPress={() => setShowCreate(!showCreate)} style={[s.addBtn, { backgroundColor: colors.primary }]}>
          <MaterialCommunityIcons name={showCreate ? "close" : "plus"} size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      {showCreate && (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={[s.createForm, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TextInput
              style={[s.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
              placeholder={t("agenda.appointmentTitlePlaceholder")}
              placeholderTextColor={colors.mutedForeground}
              value={formTitle}
              onChangeText={setFormTitle}
            />
            <TextInput
              style={[s.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
              placeholder={t("agenda.locationPlaceholder")}
              placeholderTextColor={colors.mutedForeground}
              value={formLocation}
              onChangeText={setFormLocation}
            />
            <TextInput
              style={[s.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
              placeholder={t("agenda.participantsPlaceholder")}
              placeholderTextColor={colors.mutedForeground}
              value={formParticipants}
              onChangeText={setFormParticipants}
            />
            <TextInput
              style={[s.input, s.textArea, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
              placeholder={t("agenda.descriptionPlaceholder")}
              placeholderTextColor={colors.mutedForeground}
              value={formDescription}
              onChangeText={setFormDescription}
              multiline
              numberOfLines={2}
            />
            <TouchableOpacity
              style={[s.createBtn, { backgroundColor: colors.primary, opacity: !formTitle.trim() || createAppointment.isPending ? 0.5 : 1 }]}
              onPress={handleCreate}
              disabled={!formTitle.trim() || createAppointment.isPending}
            >
              {createAppointment.isPending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={s.createBtnText}>{t("agenda.newAppointment")}</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}

      {isLoading ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : dayAppointments.length === 0 ? (
        <View style={s.center}>
          <MaterialCommunityIcons name="calendar-blank-outline" size={40} color={colors.mutedForeground + "40"} />
          <Text style={[s.emptyText, { color: colors.mutedForeground }]}>{t("agenda.noRdv")}</Text>
        </View>
      ) : (
        <FlatList
          data={dayAppointments}
          keyExtractor={(item) => item.id}
          renderItem={renderAppointment}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  monthHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  monthTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    textTransform: "capitalize",
  },
  daysRow: {
    flexDirection: "row",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
  },
  dayHeader: {
    flex: 1,
    alignItems: "center",
  },
  dayHeaderText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  dayCell: {
    width: "14.28%",
    alignItems: "center",
    paddingVertical: 6,
  },
  dayCellText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  todayText: {
    fontFamily: "Inter_700Bold",
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 2,
  },
  listHeader: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  listTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  addBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: 8,
  },
  card: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  cardTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 2,
  },
  timeText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  descText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 4,
  },
  deleteBtn: {
    padding: 6,
  },
  createForm: {
    marginHorizontal: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  textArea: {
    minHeight: 60,
    textAlignVertical: "top",
  },
  createBtn: {
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  createBtnText: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
});
