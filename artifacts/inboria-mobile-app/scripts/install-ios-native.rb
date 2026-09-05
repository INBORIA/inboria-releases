require "fileutils"
require "xcodeproj"

project_path = "ios/App/App.xcodeproj"
info_plist_path = "ios/App/App/Info.plist"
source_paths = Dir["native/ios/*.swift"].sort
destination_dir = "ios/App/App"

abort "Projet iOS généré introuvable" unless File.exist?(project_path)
abort "Info.plist iOS généré introuvable" unless File.exist?(info_plist_path)
abort "Sources natives Inboria introuvables" if source_paths.empty?

FileUtils.mkdir_p(destination_dir)
source_paths.each { |source_path| FileUtils.cp(source_path, destination_dir) }

project = Xcodeproj::Project.open(project_path)
target = project.targets.find { |candidate| candidate.name == "App" }
abort "Cible Xcode App introuvable" unless target

app_group = project.main_group.find_subpath(["App"], true)
source_paths.each do |source_path|
  filename = File.basename(source_path)
  file_ref = app_group.files.find { |file| file.path == filename }
  file_ref ||= app_group.new_file(filename)
  unless target.source_build_phase.files_references.include?(file_ref)
    target.add_file_references([file_ref])
  end
end

project.save

privacy_descriptions = {
  "NSCameraUsageDescription" =>
    "Inboria utilise l’appareil photo uniquement lorsque vous choisissez de scanner un document à joindre à un e-mail.",
  "NSFaceIDUsageDescription" =>
    "Face ID protège l’accès à vos e-mails dans Inboria."
}

info_plist = Xcodeproj::Plist.read_from_path(info_plist_path)
privacy_descriptions.each do |key, value|
  info_plist[key] = value
end
Xcodeproj::Plist.write_to_path(info_plist, info_plist_path)

verified_info_plist = Xcodeproj::Plist.read_from_path(info_plist_path)
privacy_descriptions.each do |key, expected_value|
  actual_value = verified_info_plist[key]
  abort "#{key} absent ou incorrect dans l’Info.plist iOS" unless actual_value == expected_value
end

storyboard_path = "ios/App/App/Base.lproj/Main.storyboard"
abort "Storyboard Capacitor introuvable" unless File.exist?(storyboard_path)
storyboard = File.read(storyboard_path)
storyboard.sub!(
  /customClass="CAPBridgeViewController" customModule="Capacitor"/,
  'customClass="InboriaBridgeViewController" customModule="App" customModuleProvider="target"'
)
abort "Contrôleur Capacitor introuvable dans le storyboard" unless storyboard.include?('customClass="InboriaBridgeViewController"')
File.write(storyboard_path, storyboard)

puts "Fonctions iOS natives et descriptions de confidentialité installées dans la cible App."